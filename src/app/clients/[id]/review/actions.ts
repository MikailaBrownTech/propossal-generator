"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_FIELDS } from "@/lib/extraction/fields";
import { FINDING_SEVERITIES } from "@/lib/extraction/schema";

export async function confirmProfile(
  clientId: string,
  draftProfileId: string | null,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (draftProfileId) {
    const data: Record<string, string | null> = {};
    for (const fieldName of PROFILE_FIELDS) {
      const value = String(formData.get(`field_${fieldName}`) ?? "").trim();
      data[fieldName] = value === "" ? null : value;
    }

    // Only one is_current version per client -- demote the old one first.
    await supabase
      .from("client_profiles")
      .update({ is_current: false })
      .eq("client_id", clientId)
      .eq("is_current", true);

    const { error: profileError } = await supabase
      .from("client_profiles")
      .update({
        data,
        is_current: true,
        confirmed_by: user?.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", draftProfileId);

    if (profileError) {
      redirect(`/clients/${clientId}/review?error=${encodeURIComponent(profileError.message)}`);
    }

    await supabase
      .from("profile_field_provenance")
      .update({ status: "confirmed" })
      .eq("client_profile_id", draftProfileId);

    await supabase.from("audit_log").insert({
      actor_id: user?.id,
      client_id: clientId,
      action: "confirm",
      object_type: "client_profile",
      object_id: draftProfileId,
    });
  }

  // Findings: each unresolved finding got its own set of editable form
  // fields (finding_<id>_...); confirm each one with whatever the reviewer
  // left in the form, skipping any with a required field left blank rather
  // than confirming incomplete data.
  const findingIds = formData.getAll("finding_id").map(String);

  for (const findingId of findingIds) {
    const controlArea = String(formData.get(`finding_${findingId}_control_area`) ?? "").trim();
    const technicalDescription = String(
      formData.get(`finding_${findingId}_technical_description`) ?? "",
    ).trim();
    const affectedScope = String(formData.get(`finding_${findingId}_affected_scope`) ?? "").trim();
    const severityRaw = String(formData.get(`finding_${findingId}_severity`) ?? "");
    const severity = (FINDING_SEVERITIES as readonly string[]).includes(severityRaw)
      ? severityRaw
      : undefined;

    if (!controlArea || !technicalDescription || !severity) {
      continue;
    }

    const { error: findingError } = await supabase
      .from("findings")
      .update({
        control_area: controlArea,
        technical_description: technicalDescription,
        affected_scope: affectedScope === "" ? null : affectedScope,
        severity,
        status: "confirmed",
        confirmed_by: user?.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", findingId);

    if (!findingError) {
      await supabase.from("audit_log").insert({
        actor_id: user?.id,
        client_id: clientId,
        action: "confirm",
        object_type: "finding",
        object_id: findingId,
      });
    }
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/review`);
  redirect(`/clients/${clientId}`);
}
