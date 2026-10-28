import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { endsAt } from "@/lib/time";
import { CALL_COLUMNS, type Call, type RsvpSummary } from "./types";

const LONGEST_CALL_MS = 8 * 3600_000;

/** Calls that have not finished yet, soonest first. Row level security decides which ones this person may see. */
export async function listUpcomingCalls(supabase: SupabaseClient, now = Date.now()): Promise<Call[]> {
  const since = new Date(now - LONGEST_CALL_MS).toISOString();
  const { data, error } = await supabase.from("calls").select(CALL_COLUMNS).gte("starts_at", since).order("starts_at");
  if (error || !data) return [];
  return (data as Call[]).filter((c) => endsAt(new Date(c.starts_at), c.duration_minutes).getTime() > now);
}

export async function rsvpSummary(supabase: SupabaseClient, callId: string, limit = 10): Promise<RsvpSummary> {
  const { data } = await supabase.rpc("call_rsvp_summary", { p_call: callId, p_limit: limit });
  const s = (data ?? {}) as Partial<RsvpSummary>;
  return { live: s.live ?? 0, recording: s.recording ?? 0, mine: s.mine ?? null, people: s.people ?? [] };
}

/** The call to feature at the top: an admin-pinned one that is still ahead, otherwise the next one. */
export function pickFeatured(calls: Call[]): Call | null {
  return calls.find((c) => c.pinned) ?? calls[0] ?? null;
}
