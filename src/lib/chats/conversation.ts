import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorsById } from "./queries";
import type { Msg } from "./messages";
import type { Author, ChatInfo, PostView } from "./types";

type RxRow = { post_id: string; user_id: string; kind: string; created_at: string };

/**
 * The latest messages of a community chat, oldest first, ready to show as a conversation.
 * Older replies (comments from before chats became conversations) are folded in as messages that quote the post they answered.
 */
export async function listConversation(supabase: SupabaseClient, chat: ChatInfo, me: string, isAdmin: boolean, limit: number): Promise<{ messages: Msg[]; more: boolean }> {
  const q = (cols: string) => supabase.from("chat_posts").select(cols).eq("chat_id", chat.id).order("created_at", { ascending: false }).limit(limit + 1);
  const first = await q("id, author_id, body, created_at, reply_to, image_url, edited_at, pinned_at");
  const rows = first.error ? (await q("id, author_id, body, created_at, reply_to, edited_at, pinned_at")).data : first.data;   /* before the GIF update has been run */
  const all = (rows ?? []) as unknown as { id: string; author_id: string; body: string; created_at: string; reply_to: string | null; image_url?: string | null; edited_at: string | null; pinned_at: string | null }[];
  const more = all.length > limit;
  const page = all.slice(0, limit).reverse();
  const ids = page.map((p) => p.id);
  const [{ data: comments }, { data: reactions }] = ids.length
    ? await Promise.all([
        supabase.from("chat_comments").select("id, post_id, author_id, body, created_at").in("post_id", ids).order("created_at"),
        supabase.from("chat_reactions").select("post_id, user_id, kind, created_at").in("post_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  /* posts that are quoted by a reply but are not in this page */
  const quotedIds = [...new Set(page.map((p) => p.reply_to).filter((x): x is string => !!x && !ids.includes(x)))];
  const { data: quoted } = quotedIds.length ? await supabase.from("chat_posts").select("id, author_id, body").in("id", quotedIds) : { data: [] };
  const byId = new Map<string, { author_id: string; body: string }>();
  for (const p of page) byId.set(p.id, p);
  for (const q of (quoted ?? []) as { id: string; author_id: string; body: string }[]) byId.set(q.id, q);
  const cs = (comments ?? []) as { id: string; post_id: string; author_id: string; body: string; created_at: string }[];
  const authors = await authorsById(supabase, [...page.map((p) => p.author_id), ...cs.map((c) => c.author_id), ...[...byId.values()].map((v) => v.author_id), ...((reactions ?? []) as RxRow[]).map((r) => r.user_id)]);
  const who = (id: string): Author => authors.get(id) ?? { id, name: "Member", username: null, avatar_url: null, is_admin: false };
  const quote = (id: string | null) => { const q = id ? byId.get(id) : null; return q && id ? { id, name: who(q.author_id).name, body: q.body } : null; };

  const posts: Msg[] = page.map((p) => {
    const rx = ((reactions ?? []) as RxRow[]).filter((r) => r.post_id === p.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const by = new Map<string, { name: string; at: string }[]>();
    for (const r of rx) by.set(r.kind, [...(by.get(r.kind) ?? []), { name: who(r.user_id).name, at: r.created_at }]);
    return {
      id: p.id, author: who(p.author_id), body: p.body, image_url: p.image_url, edited_at: p.edited_at, pinned: !!p.pinned_at, created_at: p.created_at, mine: p.author_id === me, canDelete: p.author_id === me || isAdmin, replyTo: quote(p.reply_to),
      reactions: [...by.entries()].map(([emoji, people]) => ({ emoji, count: people.length, people })).sort((a, b) => b.count - a.count),
      myReaction: rx.find((r) => r.user_id === me)?.kind ?? null,
    };
  });
  const legacy: Msg[] = cs.map((c) => ({ id: c.id, legacy: true, author: who(c.author_id), body: c.body, created_at: c.created_at, mine: c.author_id === me, canDelete: c.author_id === me || isAdmin, replyTo: quote(c.post_id) }));
  const messages = [...posts, ...legacy].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { messages, more };
}

export type { PostView };
