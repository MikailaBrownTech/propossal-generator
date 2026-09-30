import type { createServiceRoleClient } from "@/lib/supabase/service";
import { renderFindingsReportPdf } from "./findings-report";
import { renderProposalPdf } from "./proposal";

/** Renders the real branded PDF for an approved findings report or
 * proposal, given just its document type/id -- used by the cron dispatcher,
 * which only ever sends already-approved documents (enforced by the
 * validate_scheduled_send DB trigger), so watermark is always false here.
 * The per-document export routes call the two renderers directly instead,
 * since they also need to watermark drafts/reviewed documents. */
export async function renderDocumentPdf(
  supabase: ReturnType<typeof createServiceRoleClient>,
  documentType: "findings_report" | "proposal",
  documentId: string,
  firmName: string,
): Promise<Buffer> {
  if (documentType === "findings_report") {
    const { data: report } = await supabase
      .from("findings_reports")
      .select("client_id, executive_summary, top_priorities, finding_translations")
      .eq("id", documentId)
      .single();

    if (!report) {
      throw new Error(`findings_report ${documentId} not found`);
    }

    const { data: findings } = await supabase
      .from("findings")
      .select("id, control_area, severity")
      .eq("client_id", report.client_id)
      .eq("status", "confirmed");

    return renderFindingsReportPdf({
      firmName,
      executiveSummary: report.executive_summary ?? "",
      topPriorities: report.top_priorities ?? [],
      findingTranslations: report.finding_translations ?? [],
      findings: findings ?? [],
      watermark: false,
    });
  }

  const { data: proposal } = await supabase
    .from("proposals")
    .select("plan_id, narrative")
    .eq("id", documentId)
    .single();

  if (!proposal) {
    throw new Error(`proposal ${documentId} not found`);
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("name, price_display, fit_description, inclusions")
    .eq("id", proposal.plan_id)
    .single();

  if (!plan) {
    throw new Error(`plan ${proposal.plan_id} not found`);
  }

  return renderProposalPdf({
    firmName,
    plan: { ...plan, inclusions: plan.inclusions ?? [] },
    narrative: proposal.narrative,
    watermark: false,
  });
}
