"use server";

import { requireMember } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "We are both here": the portal counts the time, and completes the call after five minutes together. */
export async function roomBeat(id: string): Promise<{ completed: boolean }> {
  if (!UUID.test(id)) return { completed: false };
  const { supabase } = await requireMember();
  if (!supabase) return { completed: false };
  const { data } = await supabase.rpc("room_beat", { p_call: id });
  const row = ((data ?? []) as { completed: boolean }[])[0];
  return { completed: !!row?.completed };
}

/** The coach or call closer ends the call for everyone. */
export async function endRoom(id: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("end_room", { p_call: id });
  return { ok: !error };
}

/** Has the host ended the call? (The other person asks every few seconds.) */
export async function roomEnded(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const { supabase } = await requireMember();
  if (!supabase) return false;
  const { data } = await supabase.rpc("room_ended", { p_call: id });
  return data === true;
}
