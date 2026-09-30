"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateFindingsReport, FindingsReportError } from "@/lib/narrative/findings-report";

export async function generateReport(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: findings } = await supabase
    .from("findings")
    .select("id, control_area, severity, technical_description, affected_scope, evidence_excerpt")
    .eq("client_id", clientId)
    .eq("status", "confirmed");

  if (!findings || findings.length === 0) {
    redirect(
      `/clients/${clientId}?error=${encodeURIComponent("No confirmed findings yet -- confirm findings on the review screen first")}`,
    );
  }

  const outcome = await generateFindingsReport(findings).catch((err: unknown) => {
    const message = err instanceof FindingsReportError ? err.message : "Report generation failed";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(message)}`);
  });

  const { data: existing } = await supabase
    .from("findings_reports")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  const payload = {
    executive_summary: outcome.executiveSummary,
    top_priorities: outcome.topPriorities.map((p) => ({
      finding_id: p.findingId,
      rationale: p.rationale,
    })),
    finding_translations: outcome.findingTranslations.map((t) => ({
      finding_id: t.findingId,
      what_we_found: t.whatWeFound,
      why_it_matters: t.whyItMatters,
      what_we_will_do: t.whatWeWillDo,
      what_we_need_from_you: t.whatWeNeedFromYou,
    })),
    status: "draft" as const,
    generated_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    approved_at: null,
    approved_by: null,
  };

  let reportId = existing?.id;

  if (reportId) {
    await supabase.from("findings_reports").update(payload).eq("id", reportId);
  } else {
    const { data: created } = await supabase
      .from("findings_reports")
      .insert({ client_id: clientId, ...payload })
      .select("id")
      .single();
    reportId = created?.id;
  }

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "generate",
    object_type: "findings_report",
    object_id: reportId,
  });

  revalidatePath(`/clients/${clientId}/findings-report`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/findings-report`);
}

export async function saveReportEdits(reportId: string, clientId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const executiveSummary = String(formData.get("executive_summary") ?? "").trim();

  const priorityIds = formData.getAll("priority_finding_id").map(String);
  const topPriorities = priorityIds.map((findingId) => ({
    finding_id: findingId,
    rationale: String(formData.get(`priority_${findingId}_rationale`) ?? "").trim(),
  }));

  const findingIds = formData.getAll("translation_finding_id").map(String);
  const findingTranslations = findingIds.map((findingId) => ({
    finding_id: findingId,
    what_we_found: String(formData.get(`translation_${findingId}_what_we_found`) ?? "").trim(),
    why_it_matters: String(formData.get(`translation_${findingId}_why_it_matters`) ?? "").trim(),
    what_we_will_do: String(formData.get(`translation_${findingId}_what_we_will_do`) ?? "").trim(),
    what_we_need_from_you: String(
      formData.get(`translation_${findingId}_what_we_need_from_you`) ?? "",
    ).trim(),
  }));

  // Editing content after it was reviewed/approved invalidates that state --
  // require a fresh review/approval pass rather than silently keeping stale
  // approval on changed content.
  const { error } = await supabase
    .from("findings_reports")
    .update({
      executive_summary: executiveSummary,
      top_priorities: topPriorities,
      finding_translations: findingTranslations,
      status: "draft",
      reviewed_at: null,
      reviewed_by: null,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", reportId);

  if (error) {
    redirect(`/clients/${clientId}/findings-report?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "edit",
    object_type: "findings_report",
    object_id: reportId,
  });

  revalidatePath(`/clients/${clientId}/findings-report`);
  redirect(`/clients/${clientId}/findings-report`);
}

export async function markReviewed(reportId: string, clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("findings_reports")
    .update({ status: "reviewed", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "edit",
    object_type: "findings_report",
    object_id: reportId,
    metadata: { transition: "reviewed" },
  });

  revalidatePath(`/clients/${clientId}/findings-report`);
  redirect(`/clients/${clientId}/findings-report`);
}

export async function approveReport(reportId: string, clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("findings_reports")
    .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq("id", reportId);

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "approve",
    object_type: "findings_report",
    object_id: reportId,
  });

  revalidatePath(`/clients/${clientId}/findings-report`);
  redirect(`/clients/${clientId}/findings-report`);
}

export async function revertToDraft(reportId: string, clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("findings_reports")
    .update({
      status: "draft",
      reviewed_at: null,
      reviewed_by: null,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", reportId);

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "edit",
    object_type: "findings_report",
    object_id: reportId,
    metadata: { transition: "reverted_to_draft" },
  });

  revalidatePath(`/clients/${clientId}/findings-report`);
  redirect(`/clients/${clientId}/findings-report`);
}
