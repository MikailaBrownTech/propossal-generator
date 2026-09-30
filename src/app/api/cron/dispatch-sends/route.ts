import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getResendClient } from "@/lib/email/resend";
import { buildDeliveryEmail, type DocumentLabel } from "@/lib/email/templates";
import { renderDocumentPdf } from "@/lib/pdf/render-document";

// pdfkit needs Node APIs (Buffer/streams) -- not available on the edge
// runtime, and Vercel's proxy/cron infrastructure runs functions on nodejs
// by default anyway.
export const runtime = "nodejs";
export const maxDuration = 60;

// After this many failed attempts a row is left in `failed` status for
// manual review instead of being retried again on the next cron run.
const MAX_SEND_ATTEMPTS = 3;

type ClaimedSend = {
  id: string;
  document_type: "findings_report" | "proposal";
  document_id: string;
  client_id: string;
  client_contact_id: string;
  attempts: number;
  client_contacts: { name: string; email: string } | null;
  clients: { firm_name: string } | null;
};

export async function GET(request: NextRequest) {
  // Secret check FIRST, before any database access or other logic.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  // Atomically claim due rows. Vercel's own cron docs note delivery is
  // "best effort" and can invoke the same scheduled run more than once --
  // flipping pending -> processing in a single UPDATE means a second
  // overlapping invocation's WHERE status = 'pending' simply won't match
  // rows this invocation already claimed.
  const { data: claimed, error: claimError } = await supabase
    .from("scheduled_sends")
    .update({ status: "processing", last_attempted_at: now })
    .eq("status", "pending")
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .select(
      "id, document_type, document_id, client_id, client_contact_id, attempts, client_contacts(name, email), clients(firm_name)",
    )
    .returns<ClaimedSend[]>();

  if (claimError) {
    console.error("Failed to claim scheduled_sends", claimError);
    return NextResponse.json({ error: "Failed to claim sends" }, { status: 500 });
  }

  const results = { sent: 0, retried: 0, flaggedForReview: 0 };

  for (const send of claimed ?? []) {
    try {
      const email = send.client_contacts?.email;
      if (!email) {
        throw new Error("Client contact has no email on file");
      }

      const firmName = send.clients?.firm_name ?? "your firm";
      const documentLabel: DocumentLabel =
        send.document_type === "findings_report" ? "Findings Report" : "Proposal";

      const pdf = await renderDocumentPdf(supabase, send.document_type, send.document_id, firmName);

      const { subject, html, text } = buildDeliveryEmail({
        contactFirstName: send.client_contacts?.name?.split(" ")[0] ?? null,
        firmName,
        documentLabel,
      });

      const resend = getResendClient();
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: email,
        subject,
        html,
        text,
        attachments: [
          {
            filename: `${documentLabel.replace(" ", "-")}.pdf`,
            content: pdf,
          },
        ],
      });

      if (sendError) {
        throw new Error(sendError.message);
      }

      await supabase
        .from("scheduled_sends")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", send.id);

      await supabase.from("audit_log").insert({
        actor_id: null,
        client_id: send.client_id,
        action: "send",
        object_type: send.document_type,
        object_id: send.document_id,
        metadata: {
          scheduled_send_id: send.id,
          client_contact_id: send.client_contact_id,
          triggered_by: "cron",
          outcome: "sent",
        },
      });

      results.sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown send error";
      const nextAttempts = send.attempts + 1;
      const exhausted = nextAttempts >= MAX_SEND_ATTEMPTS;

      console.error(`scheduled_send ${send.id} failed (attempt ${nextAttempts}/${MAX_SEND_ATTEMPTS}):`, message);

      await supabase
        .from("scheduled_sends")
        .update({
          status: exhausted ? "failed" : "pending",
          attempts: nextAttempts,
          error: message,
        })
        .eq("id", send.id);

      await supabase.from("audit_log").insert({
        actor_id: null,
        client_id: send.client_id,
        action: "send",
        object_type: send.document_type,
        object_id: send.document_id,
        metadata: {
          scheduled_send_id: send.id,
          client_contact_id: send.client_contact_id,
          triggered_by: "cron",
          outcome: exhausted ? "failed_needs_manual_review" : "retry_scheduled",
          attempts: nextAttempts,
        },
      });

      if (exhausted) {
        results.flaggedForReview += 1;
      } else {
        results.retried += 1;
      }
    }
  }

  return NextResponse.json({ claimed: claimed?.length ?? 0, ...results });
}
