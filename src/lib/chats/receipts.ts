import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorsById } from "./queries";
import type { Msg } from "./messages";

/** Fills in who has seen each of my messages, and when they first saw it. */
export async function attachReaders(supabase: SupabaseClient, kind: "chat" | "group", target: string, messages: Msg[]): Promise<void> {
  const mine = messages.filter((m) => m.mine && !m.legacy);
  if (mine.length === 0) return;
  const since = mine.reduce((a, m) => (m.created_at < a ? m.created_at : a), mine[0].created_at);
  const { data } = await supabase.rpc("read_receipts", { p_kind: kind, p_target: target, p_since: since });
  const rows = (data ?? []) as { user_id: string; up_to: string; at: string }[];
  if (rows.length === 0) { for (const m of mine) m.readers = []; return; }
  const byUser = new Map<string, { up_to: string; at: string }[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const people = await authorsById(supabase, [...byUser.keys()]);
  for (const m of mine) {
    const readers: NonNullable<Msg["readers"]> = [];
    for (const [uid, list] of byUser) {
      const hit = list.find((x) => x.up_to >= m.created_at);   /* the list is oldest first, so this is the first time they caught up past it */
      const a = people.get(uid);
      if (hit && a) readers.push({ id: uid, name: a.name, avatar_url: a.avatar_url, at: hit.at });
    }
    m.readers = readers.sort((a, b) => a.at.localeCompare(b.at));
  }
}
