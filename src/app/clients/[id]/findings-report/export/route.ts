import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderFindingsReportPdf } from "@/lib/pdf/findings-report";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: client }, { data: report }, { data: findings }] = await Promise.all([
    supabase.from("clients").select("firm_name").eq("id", clientId).single(),
    supabase.from("findings_reports").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("findings").select("id, control_area, severity").eq("client_id", clientId).eq("status", "confirmed"),
  ]);

  if (!client || !report) {
    return NextResponse.json({ error: "Findings report not found" }, { status: 404 });
  }

  const pdf = await renderFindingsReportPdf({
    firmName: client.firm_name,
    executiveSummary: report.executive_summary ?? "",
    topPriorities: report.top_priorities ?? [],
    findingTranslations: report.finding_translations ?? [],
    findings: findings ?? [],
    watermark: report.status !== "approved",
  });

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "export",
    object_type: "findings_report",
    object_id: report.id,
    metadata: { watermarked: report.status !== "approved" },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${client.firm_name.replace(/[^a-z0-9]+/gi, "-")}-findings-report.pdf"`,
    },
  });
}
