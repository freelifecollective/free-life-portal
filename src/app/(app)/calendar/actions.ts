"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import type { RsvpMode } from "@/lib/calls/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Say how you will join a call, or take your answer back (mode = null). */
export async function setRsvp(callId: string, mode: RsvpMode | null): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(callId) || (mode !== null && mode !== "live" && mode !== "recording")) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const q = mode
    ? supabase.from("rsvps").upsert({ call_id: callId, user_id: session.user.id, mode }, { onConflict: "call_id,user_id" })
    : supabase.from("rsvps").delete().eq("call_id", callId).eq("user_id", session.user.id);
  const { error } = await q;
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/calls");
  return { ok: true };
}

/** The person's private calendar-feed key. `reset` replaces it, which switches off any calendar still using the old link. */
export async function calendarToken(reset = false): Promise<string | null> {
  const { supabase } = await requireMember();
  if (!supabase) return null;
  const { data } = await supabase.rpc("my_calendar_token", { p_reset: reset });
  if (reset) revalidatePath("/calendar");
  return typeof data === "string" ? data : null;
}
