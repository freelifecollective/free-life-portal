"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { dropBusy } from "@/lib/google/busy";
import { headers } from "next/headers";
import { addCallEvent, busyIntervals, removeCallEvent } from "@/lib/google/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A lead books one of the free times. */
export async function bookCall(iso: string): Promise<{ ok: boolean; error?: string }> {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Choose a time." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  /* the time must still be free in their Google Calendar */
  const { data: infoRows } = await supabase.rpc("booking_info");
  const info = ((infoRows ?? []) as { target_id: string; call_minutes: number }[])[0];
  if (info) {
    const busy = await busyIntervals(info.target_id, when.toISOString(), new Date(when.getTime() + info.call_minutes * 60_000).toISOString());
    if (busy && dropBusy([when.toISOString()], busy, info.call_minutes).length === 0) return { ok: false, error: "That time was just taken. Please pick another." };
  }
  const { data: bid, error } = await supabase.rpc("book_coaching_call", { p_start: when.toISOString() });
  if (error) {
    if (error.code === "23505" || error.code === "P0002") return { ok: false, error: "That time was just taken. Please pick another." };
    return { ok: false, error: "We could not book that. Please try again." };
  }
  /* the call appears on the calendar of whoever is taking it (the coach, or the call closer), with a link to the room in the portal */
  if (info && typeof bid === "string") {
    try {
      const h = await headers();
      const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
      const room = `${origin}/room/${bid}`;
      const lead = [session.profile.first_name, session.profile.last_name].filter(Boolean).join(" ") || "a lead";
      const id = await addCallEvent(info.target_id, { start: when.toISOString(), end: new Date(when.getTime() + info.call_minutes * 60_000).toISOString(), summary: `Call with ${lead}`, description: `Join the call in the portal: ${room}`, location: room });
      if (id) await createAdminClient()?.from("booked_calls").update({ google_event_id: id }).eq("id", bid);
    } catch { /* the booking stands even if the calendar could not be updated */ }
  }
  revalidatePath("/book");
  return { ok: true };
}

export async function cancelBooking(id: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { data: row } = await supabase.from("booked_calls").select("google_event_id, member_id, closer_id").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("cancel_my_booking", { p_id: id });
  const r = row as { google_event_id: string | null; member_id: string; closer_id: string | null } | null;
  if (!error && r?.google_event_id) await removeCallEvent(r.closer_id ?? r.member_id, r.google_event_id);
  revalidatePath("/book");
  return { ok: !error };
}
