import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RANKS } from "./questions";

/** The rank saved right now (1 to 7), or null if none has been set yet. */
export async function currentRank(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase.from("member_private").select("rank_id").maybeSingle();
  return (data as { rank_id: number | null } | null)?.rank_id ?? null;
}

/** The new rank's name when it is higher than one that was already set (never the first time a rank is entered). */
export function rankUp(previous: number | null, next: number | null): string | null {
  return previous !== null && next !== null && next > previous ? RANKS[next - 1] ?? null : null;
}
