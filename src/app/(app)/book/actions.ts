"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { dropBusy } from "@/lib/google/busy";
import { busyIntervals } from "@/lib/google/calendar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A lead books one of the free times. */
export async function bookCall(iso: string): Promise<{ ok: boolean; error?: string }> {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Choose a time." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  /* the time must still be free in their Google Calendar */
  const { data: infoRows } = await supabase.rpc("booking_info");
  const info = ((infoRows ?? []) as { target_id: string; call_minutes: number }[])[0];
  if (info) {
    const busy = await busyIntervals(info.target_id, when.toISOString(), new Date(when.getTime() + info.call_minutes * 60_000).toISOString());
    if (busy && dropBusy([when.toISOString()], busy, info.call_minutes).length === 0) return { ok: false, error: "That time was just taken. Please pick another." };
  }
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
