"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateProposalNarrative, ProposalNarrativeError } from "@/lib/narrative/proposal";

export async function generateProposal(clientId: string, formData: FormData) {
  const planId = String(formData.get("planId") ?? "");

  if (!planId) {
    redirect(`/clients/${clientId}/proposal?error=${encodeURIComponent("Choose a plan first")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase
      .from("client_profiles")
      .select("data")
      .eq("client_id", clientId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase.from("plans").select("name, fit_description, inclusions").eq("id", planId).single(),
  ]);

  if (!profile) {
    redirect(
      `/clients/${clientId}/proposal?error=${encodeURIComponent("No confirmed client profile yet -- confirm one first")}`,
    );
  }

  if (!plan) {
    redirect(`/clients/${clientId}/proposal?error=${encodeURIComponent("Plan not found")}`);
  }

  const narrative = await generateProposalNarrative({
    profileData: profile.data ?? {},
    plan: { name: plan.name, fit_description: plan.fit_description, inclusions: plan.inclusions ?? [] },
  }).catch((err: unknown) => {
    const message = err instanceof ProposalNarrativeError ? err.message : "Proposal generation failed";
    redirect(`/clients/${clientId}/proposal?error=${encodeURIComponent(message)}`);
  });

  const { data: existing } = await supabase
    .from("proposals")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  const payload = {
    plan_id: planId,
    narrative,
    status: "draft" as const,
    generated_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    approved_at: null,
    approved_by: null,
  };

  let proposalId = existing?.id;

  if (proposalId) {
    await supabase.from("proposals").update(payload).eq("id", proposalId);
  } else {
    const { data: created } = await supabase
      .from("proposals")
      .insert({ client_id: clientId, ...payload })
      .select("id")
      .single();
    proposalId = created?.id;
  }

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "generate",
    object_type: "proposal",
    object_id: proposalId,
  });

  revalidatePath(`/clients/${clientId}/proposal`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/proposal`);
}

export async function saveProposalEdits(proposalId: string, clientId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const narrative = {
    what_we_heard: String(formData.get("what_we_heard") ?? "").trim(),
    why_this_plan_fits: String(formData.get("why_this_plan_fits") ?? "").trim(),
    ninety_day_plan: String(formData.get("ninety_day_plan") ?? "").trim(),
    open_questions: String(formData.get("open_questions") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };

  const combined = [
    narrative.what_we_heard,
    narrative.why_this_plan_fits,
    narrative.ninety_day_plan,
    ...narrative.open_questions,
  ].join("\n");

  if (combined.includes("$")) {
    redirect(
      `/clients/${clientId}/proposal?error=${encodeURIComponent("Remove the '$' -- pricing comes from the plan card only, never the narrative")}`,
    );
  }

  const { error } = await supabase
    .from("proposals")
    .update({
      narrative,
      status: "draft",
      reviewed_at: null,
      reviewed_by: null,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", proposalId);

  if (error) {
    redirect(`/clients/${clientId}/proposal?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "edit",
    object_type: "proposal",
    object_id: proposalId,
  });

  revalidatePath(`/clients/${clientId}/proposal`);
  redirect(`/clients/${clientId}/proposal`);
}

export async function markReviewed(proposalId: string, clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("proposals")
    .update({ status: "reviewed", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
    .eq("id", proposalId);

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "edit",
    object_type: "proposal",
    object_id: proposalId,
    metadata: { transition: "reviewed" },
  });

  revalidatePath(`/clients/${clientId}/proposal`);
  redirect(`/clients/${clientId}/proposal`);
}

export async function approveProposal(proposalId: string, clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("proposals")
    .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq("id", proposalId);

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "approve",
    object_type: "proposal",
    object_id: proposalId,
  });

  revalidatePath(`/clients/${clientId}/proposal`);
  redirect(`/clients/${clientId}/proposal`);
}

export async function revertToDraft(proposalId: string, clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("proposals")
    .update({
      status: "draft",
      reviewed_at: null,
      reviewed_by: null,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", proposalId);

  await supabase.from("audit_log").insert({
    actor_id: user?.id,
    client_id: clientId,
    action: "edit",
    object_type: "proposal",
    object_id: proposalId,
    metadata: { transition: "reverted_to_draft" },
  });

  revalidatePath(`/clients/${clientId}/proposal`);
  redirect(`/clients/${clientId}/proposal`);
}
