"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result = { ok: boolean; error?: string };
const refresh = () => { revalidatePath("/financing"); revalidatePath("/admin/financing"); revalidatePath("/", "layout"); };

export async function reviewFinancing(id: string, decision: "approved" | "declined", note: string): Promise<Result> {
  if (!UUID.test(id) || (decision !== "approved" && decision !== "declined")) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireAdmin();
  const { error } = await supabase.from("financing_options")
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: session.user.id, review_note: note.trim().slice(0, 500) || null }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "An option with that name is already approved." : "We could not save that." };
  refresh();
  return { ok: true };
}

export async function removeFinancing(id: string): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("financing_options").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not remove that." };
  refresh();
  return { ok: true };
}
