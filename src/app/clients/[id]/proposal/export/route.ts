import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderProposalPdf } from "@/lib/pdf/proposal";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: client }, { data: proposal }] = await Promise.all([
    supabase.from("clients").select("firm_name").eq("id", clientId).single(),
    supabase.from("proposals").select("*").eq("client_id", clientId).maybeSingle(),
  ]);

  if (!client || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("name, price_display, fit_description, inclusions")
    .eq("id", proposal.plan_id)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const pdf = await renderProposalPdf({
    firmName: client.firm_name,
    plan: { ...plan, inclusions: plan.inclusions ?? [] },
    narrative: proposal.narrative,
    watermark: proposal.status !== "approved",
  });

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "export",
    object_type: "proposal",
    object_id: proposal.id,
    metadata: { watermarked: proposal.status !== "approved" },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${client.firm_name.replace(/[^a-z0-9]+/gi, "-")}-proposal.pdf"`,
    },
  });
}
