import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Author, ChatInfo, ChatSection, PostView } from "./types";
import type { Role } from "@/lib/roles";

const CHAT_COLUMNS = "id, section_id, slug, name, description, sort, votes_on, min_role, description_lead, posting, replies_allowed, show_views, divider_after";

/** Sections and their chats. Row level security hides what this person may not see. */
export async function listChatSections(supabase: SupabaseClient): Promise<ChatSection[]> {
  const [{ data: sections }, { data: chats }] = await Promise.all([
    supabase.from("chat_sections").select("id, name, min_role").order("sort"),
    supabase.from("chats").select(CHAT_COLUMNS).order("sort"),
  ]);
  return ((sections ?? []) as { id: number; name: string; min_role: Role }[]).map((s) => ({ ...s, chats: ((chats ?? []) as ChatInfo[]).filter((c) => c.section_id === s.id) }));
}

export async function getChat(supabase: SupabaseClient, slug: string): Promise<ChatInfo | null> {
  const { data } = await supabase.from("chats").select(CHAT_COLUMNS).eq("slug", slug).maybeSingle();
  return (data as ChatInfo | null) ?? null;
}

type CardRow = { id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; is_admin: boolean };

export async function authorsById(supabase: SupabaseClient, ids: string[]): Promise<Map<string, Author>> {
  const out = new Map<string, Author>();
  if (!ids.length) return out;
  const { data } = await supabase.from("profile_cards").select("id, first_name, last_name, username, avatar_url, is_admin").in("id", [...new Set(ids)]);
  for (const r of (data ?? []) as CardRow[]) out.set(r.id, { id: r.id, name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Member", username: r.username, avatar_url: r.avatar_url, is_admin: !!r.is_admin });
  return out;
}

/** Newest first. Comments, reactions and votes are fetched in one go for just these posts. */
export async function listPosts(supabase: SupabaseClient, chat: ChatInfo, me: string, limit: number, pinned = false): Promise<{ posts: PostView[]; more: boolean }> {
  const base = supabase.from("chat_posts").select("id, author_id, body, created_at, edited_at, pinned_at").eq("chat_id", chat.id);
  const { data: rows } = await (pinned
    ? base.not("pinned_at", "is", null).order("pinned_at", { ascending: false }).limit(10)
    : base.is("pinned_at", null).order("created_at", { ascending: false }).limit(limit + 1));
  const all = rows ?? [];
  const more = all.length > limit;
  const page = all.slice(0, limit);
  const ids = page.map((p) => p.id);
  const [{ data: comments }, { data: reactions }, { data: votes }, { data: viewRows }] = ids.length
    ? await Promise.all([
        supabase.from("chat_comments").select("id, post_id, author_id, body, created_at").in("post_id", ids).order("created_at"),
        supabase.from("chat_reactions").select("post_id, user_id, kind, created_at").in("post_id", ids),
        chat.votes_on ? supabase.from("chat_votes").select("post_id, user_id").in("post_id", ids) : Promise.resolve({ data: [] }),
        chat.show_views ? supabase.rpc("post_view_counts", { p_posts: ids }) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const authors = await authorsById(supabase, [...page.map((p) => p.author_id), ...(comments ?? []).map((c) => c.author_id), ...(reactions ?? []).map((r) => r.user_id)]);
  const who = (id: string): Author => authors.get(id) ?? { id, name: "Member", username: null, avatar_url: null, is_admin: false };

  const posts = page.map<PostView>((p) => {
    const rx = (reactions ?? []).filter((r) => r.post_id === p.id);
    const vs = (votes ?? []).filter((v) => v.post_id === p.id);
    return {
      id: p.id, author: who(p.author_id), body: p.body, created_at: p.created_at, edited: !!p.edited_at, pinned: !!p.pinned_at, mine: p.author_id === me,
      comments: (comments ?? []).filter((c) => c.post_id === p.id).map((c) => ({ id: c.id, author: who(c.author_id), body: c.body, created_at: c.created_at, mine: c.author_id === me })),
      reactions: summarize(rx, who), myReaction: rx.find((x) => x.user_id === me)?.kind ?? null,
      votes: vs.length, voted: vs.some((v) => v.user_id === me),
      views: ((viewRows ?? []) as { post_id: string; views: number }[]).find((v) => v.post_id === p.id)?.views ?? 0,
    };
  });
  return { posts, more };
}

type RxRow = { user_id: string; kind: string; created_at: string };
function summarize(rows: RxRow[], who: (id: string) => Author): PostView["reactions"] {
  const by = new Map<string, { name: string; at: string }[]>();
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const list = by.get(r.kind) ?? [];
    list.push({ name: who(r.user_id).name, at: r.created_at });
    by.set(r.kind, list);
  }
  return [...by.entries()].map(([emoji, people]) => ({ emoji, count: people.length, people })).sort((a, b) => b.count - a.count);
}
