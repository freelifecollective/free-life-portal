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
export async function sendMessage(chatId: string, slug: string, body: string, replyTo: string | null): Promise<Result> {
  const text = String(body ?? "").trim();
  if (!UUID.test(chatId) || (replyTo && !UUID.test(replyTo))) return { ok: false, error: "Something went wrong." };
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > POST_MAX) return { ok: false, error: `Please keep messages under ${POST_MAX} characters.` };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Chats need the database, which preview mode does not have." };
  const { error } = await supabase.from("chat_posts").insert({ chat_id: chatId, author_id: session.user.id, body: text, ...(replyTo ? { reply_to: replyTo } : {}) });
  if (error) return { ok: false, error: "We could not send that. Please try again." };
  refresh(slug);
  return { ok: true };
}
