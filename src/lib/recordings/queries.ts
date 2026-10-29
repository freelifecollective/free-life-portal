import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Recording = {
  id: string; call_id: string | null; title: string; description: string | null; recorded_at: string; vimeo_id: string; vimeo_hash: string | null;
  thumb_url: string | null; duration_secs: number | null; start_secs: number; end_secs: number | null; for_leads: boolean; for_downline: boolean; published: boolean; topics: string[];
};
const COLS = "id, call_id, title, description, recorded_at, vimeo_id, vimeo_hash, thumb_url, duration_secs, start_secs, end_secs, for_leads, for_downline, published, topics";

export async function listRecordings(supabase: SupabaseClient): Promise<Recording[]> {
  const { data } = await supabase.from("recordings").select(COLS).order("recorded_at", { ascending: false }).limit(200);
  return (data ?? []) as Recording[];
}
export async function getRecording(supabase: SupabaseClient, id: string): Promise<Recording | null> {
  const { data } = await supabase.from("recordings").select(COLS).eq("id", id).maybeSingle();
  return (data as Recording | null) ?? null;
}
