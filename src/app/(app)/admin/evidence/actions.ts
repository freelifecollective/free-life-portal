"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { SUPABASE_URL } from "@/lib/env";
import { RANKS, STORY_TYPES } from "@/lib/resources/kinds";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type EvState = { error: string; done: string };

export async function addEvidence(_p: EvState, form: FormData): Promise<EvState> {
  const { session, supabase } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const rank = String(form.get("rank") ?? "");
  const story_type = String(form.get("story_type") ?? "");
  const story = String(form.get("story") ?? "").trim();
  const photo = String(form.get("photo_url") ?? "").trim();
  if (!name || name.length > 120) return { error: "Enter their name (up to 120 characters).", done: "" };
  if (!(RANKS as readonly string[]).includes(rank)) return { error: "Choose their top rank.", done: "" };
  if (!STORY_TYPES.some(([v]) => v === story_type)) return { error: "Choose what kind of story it is.", done: "" };
  if (!story || story.length > 6000) return { error: "Paste their story (up to 6000 characters).", done: "" };
  if (photo && !photo.startsWith(`${SUPABASE_URL}/storage/v1/object/public/avatars/${session.user.id}/`)) return { error: "Their picture did not upload. Please try again.", done: "" };
  const { error } = await supabase.from("evidence_stories").insert({ name, rank, story_type, story, photo_url: photo || null });
  if (error) return { error: "We could not save that. Please try again.", done: "" };
  revalidatePath("/admin/evidence"); revalidatePath("/advertising/evidence-manual");
  return { error: "", done: `Added ${name}.` };
}

export async function deleteEvidence(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("evidence_stories").delete().eq("id", id);
  revalidatePath("/admin/evidence"); revalidatePath("/advertising/evidence-manual");
}
