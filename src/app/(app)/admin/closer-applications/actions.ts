"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function reviewApplication(id: string, approve: boolean, note: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("review_closer_application", { p_id: id, p_approve: approve, p_note: note.trim().slice(0, 500) || null });
  if (error) return { ok: false, error: "We could not save that. It may already have been answered." };
  revalidatePath("/admin/closer-applications");
  revalidatePath("/call-closers");
  revalidatePath("/", "layout");
  return { ok: true };
}
