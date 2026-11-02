"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { RESOURCE_TABS } from "@/lib/resources/kinds";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type AddState = { error: string; done: string };

export async function addResource(_p: AddState, form: FormData): Promise<AddState> {
  const { supabase } = await requireAdmin();
  const category = String(form.get("category") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const image = String(form.get("image_url") ?? "").trim();
  if (!RESOURCE_TABS.some((t) => t.category === category)) return { error: "Choose where it goes.", done: "" };
  if (!title || title.length > 160) return { error: "Give it a title of up to 160 characters.", done: "" };
  if (!/^https:\/\/\S+$/.test(url)) return { error: "The link must start with https://", done: "" };
  if (image && !/^https:\/\/\S+$/.test(image)) return { error: "The picture link must start with https://", done: "" };
  if (description.length > 600) return { error: "Keep the description under 600 characters.", done: "" };
  const { error } = await supabase.from("resource_items").insert({ category, title, description: description || null, url, image_url: image || null });
  if (error) return { error: "We could not save that. Please try again.", done: "" };
  revalidatePath("/admin/resource-library");
  return { error: "", done: `Added “${title}”.` };
}

export async function deleteResource(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("resource_items").delete().eq("id", id);
  revalidatePath("/admin/resource-library");
}
