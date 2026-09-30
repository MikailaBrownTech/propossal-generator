"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redact } from "@/lib/redaction/redact";
import { extractFromSourceDocument } from "@/lib/extraction/extract";

const VALID_SOURCE_TYPES = ["meeting_notes", "vulnerability_report", "risk_assessment"] as const;
type SourceType = (typeof VALID_SOURCE_TYPES)[number];

export async function addContact(clientId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const isPrimary = formData.get("isPrimary") === "on";

  if (!name || !email) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent("Contact name and email are required")}`);
  }

  const supabase = await createClient();

  if (isPrimary) {
    // Only one is_primary contact per client (enforced by a partial unique
    // index too, but clearing first avoids a spurious constraint error).
    await supabase.from("client_contacts").update({ is_primary: false }).eq("client_id", clientId);
  }

  const { error } = await supabase
    .from("client_contacts")
    .insert({ client_id: clientId, name, email, title, phone, is_primary: isPrimary });

  if (error) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function addSourceDocument(clientId: string, formData: FormData) {
  const rawText = String(formData.get("rawText") ?? "");
  const sourceType = String(formData.get("sourceType") ?? "") as SourceType;

  if (!rawText.trim()) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent("Paste some text first")}`);
  }

  if (!VALID_SOURCE_TYPES.includes(sourceType)) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent("Choose a valid source type")}`);
  }

  // Redact BEFORE anything touches the database.
  const { redactedText, redactionLog } = redact(rawText);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("source_documents")
    .insert({
      client_id: clientId,
      source_type: sourceType,
      redacted_text: redactedText,
      redaction_log: redactionLog,
      uploaded_by: user?.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(error?.message ?? "Failed to save source document")}`);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?highlight=${data.id}`);
}

export async function runExtraction(clientId: string, sourceDocumentId: string) {
  const supabase = await createClient();

  const { data: sourceDoc } = await supabase
    .from("source_documents")
    .select("id, source_type, redacted_text")
    .eq("id", sourceDocumentId)
    .single();

  if (!sourceDoc) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent("Source document not found")}`);
  }

  const outcome = await extractFromSourceDocument({
    sourceType: sourceDoc.source_type,
    redactedText: sourceDoc.redacted_text,
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Extraction failed";
    redirect(`/clients/${clientId}?error=${encodeURIComponent(`Extraction failed: ${message}`)}`);
  });

  // Find this client's pending (unconfirmed) draft profile version, or
  // start one -- multiple documents accumulate into the same draft until a
  // human confirms it.
  const { data: existingDraft } = await supabase
    .from("client_profiles")
    .select("id")
    .eq("client_id", clientId)
    .is("confirmed_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let draftId = existingDraft?.id;

  if (!draftId) {
    const { data: latest } = await supabase
      .from("client_profiles")
      .select("version")
      .eq("client_id", clientId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: newDraft } = await supabase
      .from("client_profiles")
      .insert({ client_id: clientId, version: (latest?.version ?? 0) + 1, is_current: false, data: {} })
      .select("id")
      .single();

    if (!newDraft) {
      redirect(`/clients/${clientId}?error=${encodeURIComponent("Failed to create draft profile")}`);
    }

    draftId = newDraft.id;
  }

  // Append provenance for every field the model actually found -- never
  // overwrite; an earlier document's value stays visible as history on the
  // review screen until a human decides which one to keep.
  const provenanceRows = outcome.profile_fields
    .filter((field) => field.value !== null)
    .map((field) => ({
      client_profile_id: draftId,
      field_name: field.field_name,
      value: field.value,
      source_document_id: sourceDocumentId,
      source_excerpt: field.source_excerpt,
      status: "unresolved" as const,
    }));

  if (provenanceRows.length > 0) {
    await supabase.from("profile_field_provenance").insert(provenanceRows);
  }

  // Findings (only present for vulnerability_report / risk_assessment).
  if (outcome.findings.length > 0) {
    const findingRows = outcome.findings.map((finding) => ({
      client_id: clientId,
      control_area: finding.control_area,
      technical_description: finding.technical_description,
      affected_scope: finding.affected_scope,
      severity: finding.severity,
      evidence_excerpt: finding.evidence_excerpt,
      source_document_id: sourceDocumentId,
      status: "unresolved" as const,
    }));

    await supabase.from("findings").insert(findingRows);
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/review`);
  redirect(`/clients/${clientId}/review`);
}
