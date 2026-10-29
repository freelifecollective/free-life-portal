"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";

export async function undoActivity(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("undo_audit", { p_id: id });
  if (error) return { ok: false, error: "We could not undo that." };
  const r = data as { ok: boolean; reason?: string };
  if (!r.ok) return { ok: false, error: r.reason ?? "We could not undo that." };
  revalidatePath("/", "layout");
  return { ok: true };
}
