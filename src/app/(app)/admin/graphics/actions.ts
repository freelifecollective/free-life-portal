"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { SUPABASE_URL } from "@/lib/env";
import { cleanLayout, DEFAULT_LAYOUT } from "@/lib/graphics/layout";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type R = { ok: true; id?: string } | { ok: false; error: string };
const refresh = () => { revalidatePath("/admin/graphics"); revalidatePath("/graphic-maker"); };

export async function createTemplate(title: string, imageUrl: string): Promise<R> {
  const t = title.trim();
  if (!t || t.length > 80) return { ok: false, error: "Give the template a title of up to 80 characters." };
  const { session, supabase } = await requireAdmin();
  if (!imageUrl.startsWith(`${SUPABASE_URL}/storage/v1/object/public/avatars/${session.user.id}/`)) return { ok: false, error: "Your picture did not upload. Please try again." };
  const { data, error } = await supabase.from("graphic_templates").insert({ title: t, image_url: imageUrl, layout: DEFAULT_LAYOUT }).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "We could not save that. Please try again." };
  refresh();
  return { ok: true, id: (data as { id: string }).id };
}

export async function saveTemplate(id: string, title: string, published: boolean, layout: unknown): Promise<R> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const t = title.trim();
  if (!t || t.length > 80) return { ok: false, error: "Give the template a title of up to 80 characters." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("graphic_templates").update({ title: t, published: !!published, layout: cleanLayout(layout) }).eq("id", id);
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  refresh();
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<R> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("graphic_templates").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not delete that." };
  refresh();
  return { ok: true };
}
