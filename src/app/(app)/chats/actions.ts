"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { EMOJI_SET } from "@/lib/chats/emoji";
import { COMMENT_MAX, POST_MAX } from "@/lib/chats/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ChatFormState = { error: string; sent?: number };
type Result = { ok: boolean; error?: string };

const refresh = (slug: string) => { revalidatePath(`/chats/${slug}`); };

export async function createPost(chatId: string, slug: string, prev: ChatFormState, form: FormData): Promise<ChatFormState> {
  const body = String(form.get("body") ?? "").trim();
  if (!UUID.test(chatId)) return { error: "Something went wrong." };
  if (!body) return { error: "Write something first." };
  if (body.length > POST_MAX) return { error: `Please keep posts under ${POST_MAX} characters.` };
  const { session, supabase } = await requireMember();
  if (!supabase) return { error: "Chats need the database, which preview mode does not have." };
  const { error } = await supabase.from("chat_posts").insert({ chat_id: chatId, author_id: session.user.id, body });
  if (error) return { error: "We could not post that. Please try again." };
  refresh(slug);
  return { error: "", sent: (prev.sent ?? 0) + 1 };
}

export async function addComment(postId: string, slug: string, prev: ChatFormState, form: FormData): Promise<ChatFormState> {
  const body = String(form.get("body") ?? "").trim();
  if (!UUID.test(postId)) return { error: "Something went wrong." };
  if (!body) return { error: "Write a reply first." };
  if (body.length > COMMENT_MAX) return { error: `Please keep replies under ${COMMENT_MAX} characters.` };
  const { session, supabase } = await requireMember();
  if (!supabase) return { error: "Needs the database." };
  const { error } = await supabase.from("chat_comments").insert({ post_id: postId, author_id: session.user.id, body });
  if (error) return { error: "We could not post that reply. Please try again." };
  refresh(slug);
  return { error: "", sent: (prev.sent ?? 0) + 1 };
}

/** Choose an emoji, change it, or take it back (emoji = null). One reaction per person per post, like Facebook. */
export async function setReaction(postId: string, slug: string, emoji: string | null): Promise<Result> {
  if (!UUID.test(postId) || (emoji !== null && !EMOJI_SET.has(emoji))) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = emoji
    ? await supabase.from("chat_reactions").upsert({ post_id: postId, user_id: session.user.id, kind: emoji, created_at: new Date().toISOString() }, { onConflict: "post_id,user_id" })
    : await supabase.from("chat_reactions").delete().eq("post_id", postId).eq("user_id", session.user.id);
  if (error) return { ok: false, error: "We could not save that." };
  refresh(slug);
  return { ok: true };
}

export async function toggleVote(postId: string, slug: string, on: boolean): Promise<Result> {
  if (!UUID.test(postId)) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = on
    ? await supabase.from("chat_votes").upsert({ post_id: postId, user_id: session.user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await supabase.from("chat_votes").delete().eq("post_id", postId).eq("user_id", session.user.id);
  if (error) return { ok: false, error: "We could not save your vote." };
  refresh(slug);
  revalidatePath("/responses");
  return { ok: true };
}

export async function deletePost(postId: string, slug: string): Promise<Result> {
  if (!UUID.test(postId)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("chat_posts").delete().eq("id", postId);
  if (error) return { ok: false, error: "We could not delete that." };
  refresh(slug);
  return { ok: true };
}

export async function deleteComment(commentId: string, slug: string): Promise<Result> {
  if (!UUID.test(commentId)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("chat_comments").delete().eq("id", commentId);
  if (error) return { ok: false, error: "We could not delete that." };
  refresh(slug);
  return { ok: true };
}

/** Admins only: pin a post to the top of its chat, or take it down again. */
export async function pinPost(postId: string, slug: string, on: boolean): Promise<Result> {
  if (!UUID.test(postId)) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role !== "admin") return { ok: false, error: "Only admins can pin posts." };
  const { error } = await supabase.rpc("set_post_pinned", { p_post: postId, p_pinned: on });
  if (error) return { ok: false, error: "We could not pin that." };
  refresh(slug);
  return { ok: true };
}

/** Counts these posts as seen by the signed-in person (only chats that show view counts keep them). */
export async function markSeen(postIds: string[]): Promise<void> {
  const ids = postIds.filter((x) => UUID.test(x)).slice(0, 100);
  if (!ids.length) return;
  const { supabase } = await requireMember();
  await supabase?.rpc("mark_posts_seen", { p_posts: ids });
}

/** Sends a message in a conversation chat, optionally quoting an earlier message. */
const GIF = /^https:\/\/media\d*\.giphy\.com\//;

const VOICE = /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/voice-notes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|m4a|ogg)$/i;
export type Voice = { url: string; secs: number };

export async function sendMessage(chatId: string, slug: string, body: string, replyTo: string | null, image: string | null = null, voice: Voice | null = null): Promise<Result> {
  if (image && !GIF.test(image)) return { ok: false, error: "That GIF did not work." };
  if (voice && (!VOICE.test(voice.url) || !(voice.secs >= 1 && voice.secs <= 3600))) return { ok: false, error: "That voice note did not work." };
  const text = voice ? "Voice note" : image ? "GIF" : String(body ?? "").trim();
  if (!UUID.test(chatId) || (replyTo && !UUID.test(replyTo))) return { ok: false, error: "Something went wrong." };
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > POST_MAX) return { ok: false, error: `Please keep messages under ${POST_MAX} characters.` };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Chats need the database, which preview mode does not have." };
  const { error } = await supabase.from("chat_posts").insert({ chat_id: chatId, author_id: session.user.id, body: text, ...(image ? { image_url: image } : {}), ...(voice ? { audio_url: voice.url, audio_secs: Math.round(voice.secs) } : {}), ...(replyTo ? { reply_to: replyTo } : {}) });
  if (error) return { ok: false, error: "We could not send that. Please try again." };
  refresh(slug);
  return { ok: true };
}

/** Tells the portal I have read this chat up to now (so its unread number goes away). */
export async function markChatRead(chatId: string): Promise<void> {
  if (!UUID.test(chatId)) return;
  const { supabase } = await requireMember();
  await supabase?.rpc("mark_chat_read", { p_chat: chatId });
}

/** Change the words of a message I sent. It shows "edited" afterwards. */
export async function editMessage(kind: "chat" | "group", id: string, body: string): Promise<Result> {
  const text = String(body ?? "").trim();
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > POST_MAX) return { ok: false, error: `Please keep messages under ${POST_MAX} characters.` };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Chats need the database, which preview mode does not have." };
  if (kind === "group") {
    const { data, error } = await supabase.rpc("edit_group_message", { p_id: id, p_body: text });
    return error || !data ? { ok: false, error: "We could not save that change." } : { ok: true };
  }
  const { data, error } = await supabase.from("chat_posts").update({ body: text, edited_at: new Date().toISOString() }).eq("id", id).eq("author_id", session.user.id).is("image_url", null).select("id");
  return error || !data?.length ? { ok: false, error: "We could not save that change." } : { ok: true };
}

export type Hit = { id: string; name: string; body: string; created_at: string };

const likeSafe = (q: string) => q.replace(/[\\%_]/g, (c) => "\\" + c);

/** Looks for words inside one chat or group. */
export async function searchMessages(kind: "chat" | "group", target: string, q: string): Promise<Hit[]> {
  const term = String(q ?? "").trim().slice(0, 80);
  if (term.length < 2 || !UUID.test(target)) return [];
  const { supabase } = await requireMember();
  if (!supabase) return [];
  const { data } = kind === "group"
    ? await supabase.from("group_messages").select("id, author_id, body, created_at").eq("group_id", target).ilike("body", `%${likeSafe(term)}%`).order("created_at", { ascending: false }).limit(30)
    : await supabase.from("chat_posts").select("id, author_id, body, created_at").eq("chat_id", target).ilike("body", `%${likeSafe(term)}%`).order("created_at", { ascending: false }).limit(30);
  const rows = (data ?? []) as { id: string; author_id: string | null; body: string; created_at: string }[];
  const ids = [...new Set(rows.map((r) => r.author_id).filter((x): x is string => !!x))];
  const { data: cards } = ids.length ? await supabase.from("profile_cards").select("id, first_name, last_name").in("id", ids) : { data: [] };
  const names = new Map(((cards ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(" ") || "Member"]));
  return rows.map((r) => ({ id: r.id, name: (r.author_id && names.get(r.author_id)) || "Member", body: r.body, created_at: r.created_at }));
}

/** A voice note posted in a feed-style chat (the recording has already been uploaded). */
export async function postVoice(chatId: string, slug: string, url: string, secs: number): Promise<Result> {
  if (!UUID.test(chatId) || !VOICE.test(url) || !(secs >= 1 && secs <= 3600)) return { ok: false, error: "That voice note did not work." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Chats need the database, which preview mode does not have." };
  const { error } = await supabase.from("chat_posts").insert({ chat_id: chatId, author_id: session.user.id, body: "Voice note", audio_url: url, audio_secs: Math.round(secs) });
  if (error) return { ok: false, error: "We could not post that. Please try again." };
  refresh(slug);
  return { ok: true };
}
