"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A lead books one of the free times. */
export async function bookCall(iso: string): Promise<{ ok: boolean; error?: string }> {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Choose a time." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("book_coaching_call", { p_start: when.toISOString() });
  if (error) {
    if (error.code === "23505" || error.code === "P0002") return { ok: false, error: "That time was just taken. Please pick another." };
    return { ok: false, error: "We could not book that. Please try again." };
  }
  revalidatePath("/book");
  return { ok: true };
}

export async function cancelBooking(id: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("cancel_my_booking", { p_id: id });
  revalidatePath("/book");
  return { ok: !error };
}
