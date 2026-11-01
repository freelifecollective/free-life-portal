import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The chats and groups this person has muted right now, as "chat:<id>" / "group:<id>". */
export async function activeMutes(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("chat_mutes").select("kind, target, until");
  const now = new Date().toISOString();
  return new Set(((data ?? []) as { kind: string; target: string; until: string | null }[]).filter((m) => !m.until || m.until > now).map((m) => `${m.kind}:${m.target}`));
}
