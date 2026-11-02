"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { RESOURCE_KINDS } from "@/lib/support/types";

export type ResourceState = { error: string; done: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addResource(_prev: ResourceState, form: FormData): Promise<ResourceState> {
  const { supabase } = await requireAdmin();
  const kind = String(form.get("kind") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const keywords = String(form.get("keywords") ?? "").trim();
  if (!(RESOURCE_KINDS as readonly string[]).includes(kind)) return { error: "Choose what kind of resource it is.", done: "" };
  if (!title || title.length > 160) return { error: "Give it a title of up to 160 characters.", done: "" };
  if (description.length > 600 || keywords.length > 600) return { error: "Keep the description and keywords under 600 characters.", done: "" };
  if (url && !/^https:\/\/\S+$/.test(url)) return { error: "A link must start with https://", done: "" };
  const { error } = await supabase.from("support_resources").insert({
    kind, title, description: description || null, url: url || null, keywords: keywords || null,
    for_leads: form.get("for_leads") === "on", for_downline: form.get("for_downline") === "on",
  });
  if (error) return { error: "We could not add that. Please try again.", done: "" };
  revalidatePath("/admin/support");
  return { error: "", done: `Added “${title}”.` };
}

export async function removeResource(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("support_resources").delete().eq("id", id);
  revalidatePath("/admin/support");
}

export async function clearQuestion(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("support_questions").delete().eq("id", id);
  revalidatePath("/admin/support");
}
