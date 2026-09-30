"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createClientRecord(formData: FormData) {
  const firmName = String(formData.get("firmName") ?? "").trim();
  const firmType = String(formData.get("firmType") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!firmName) {
    redirect(`/clients/new?error=${encodeURIComponent("Firm name is required")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("clients")
    .insert({ firm_name: firmName, firm_type: firmType, state, notes, created_by: user?.id })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/clients/new?error=${encodeURIComponent(error?.message ?? "Failed to create client")}`);
  }

  revalidatePath("/");
  redirect(`/clients/${data.id}`);
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  const firmName = String(formData.get("firmName") ?? "").trim();
  const firmType = String(formData.get("firmType") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!firmName) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent("Firm name is required")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ firm_name: firmName, firm_type: firmType, state, notes })
    .eq("id", clientId);

  if (error) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
  redirect(`/clients/${clientId}`);
}
