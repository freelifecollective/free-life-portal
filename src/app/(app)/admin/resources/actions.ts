"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reviewSubmission(id: string, decision: "accepted" | "declined", note: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id) || (decision !== "accepted" && decision !== "declined")) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireAdmin();
  const { error } = await supabase.from("resource_submissions")
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: session.user.id, review_note: note.trim().slice(0, 500) || null })
    .eq("id", id);
  if (error) return { ok: false, error: "We could not save that." };
  revalidatePath("/admin/resources");
  revalidatePath("/", "layout");
  return { ok: true };
}
