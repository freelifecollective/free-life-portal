import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Dm = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null; image_url?: string | null };
export type Person = { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; is_admin: boolean };
export type Conversation = { other: Person; last: Dm; unread: number; preview: Dm[] };

const COLS = "id, sender_id, recipient_id, body, created_at, read_at, image_url";
export const fullName = (p: Pick<Person, "first_name" | "last_name">) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";

export async function personByUsername(supabase: SupabaseClient, username: string): Promise<Person | null> {
  const { data } = await supabase.from("profile_cards").select("id, first_name, last_name, username, avatar_url, is_admin").eq("username", username.toLowerCase()).maybeSingle();
  return (data as Person | null) ?? null;
}

/** One row per person you have talked to, newest first. Reading this list never marks anything as read. */
export async function listConversations(supabase: SupabaseClient, me: string): Promise<Conversation[]> {
  const { data } = await supabase.from("direct_messages").select(COLS).order("created_at", { ascending: false }).limit(400);
  const rows = (data ?? []) as Dm[];
  const by = new Map<string, Dm[]>();
  for (const m of rows) {
    const other = m.sender_id === me ? m.recipient_id : m.sender_id;
    by.set(other, [...(by.get(other) ?? []), m]);
  }
  if (by.size === 0) return [];
  const { data: cards } = await supabase.from("profile_cards").select("id, first_name, last_name, username, avatar_url, is_admin").in("id", [...by.keys()]);
  const people = new Map(((cards ?? []) as Person[]).map((p) => [p.id, p]));
  return [...by.entries()].flatMap(([id, msgs]) => {
    const other = people.get(id);
    if (!other) return [];
    return [{ other, last: msgs[0], unread: msgs.filter((m) => m.recipient_id === me && !m.read_at).length, preview: msgs.slice(0, 8).reverse() }];
  });
}

export async function getThread(supabase: SupabaseClient, me: string, other: string): Promise<Dm[]> {
  const { data } = await supabase.from("direct_messages").select(COLS)
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as Dm[]).reverse();
}

export async function messageablePeople(supabase: SupabaseClient): Promise<Person[]> {
  const { data } = await supabase.rpc("messageable_people");
  return (data ?? []) as Person[];
}

export async function unreadMessageCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("direct_messages").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}
