"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { EMOJI_SET } from "@/lib/chats/emoji";
import { COMMENT_MAX, POST_MAX } from "@/lib/chats/types";
import { validAttach, type Attach } from "@/lib/chats/attach";

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

export async function sendMessage(chatId: string, slug: string, body: string, replyTo: string | null, image: string | null = null, voice: Voice | null = null, attach: Attach | null = null): Promise<Result> {
  if (attach && !validAttach(attach)) return { ok: false, error: "That file did not work." };
  if (image && !GIF.test(image)) return { ok: false, error: "That GIF did not work." };
  if (voice && (!VOICE.test(voice.url) || !(voice.secs >= 1 && voice.secs <= 900))) return { ok: false, error: "That voice note did not work." };
  const text = voice ? "Voice note" : image ? "GIF" : attach ? "Attachment" : String(body ?? "").trim();
  if (!UUID.test(chatId) || (replyTo && !UUID.test(replyTo))) return { ok: false, error: "Something went wrong." };
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > POST_MAX) return { ok: false, error: `Please keep messages under ${POST_MAX} characters.` };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Chats need the database, which preview mode does not have." };
  const { error } = await supabase.from("chat_posts").insert({ chat_id: chatId, author_id: session.user.id, body: text, ...(image ? { image_url: image } : {}), ...(voice ? { audio_url: voice.url, audio_secs: Math.round(voice.secs) } : {}), ...(attach ? { attach_url: attach.url, attach_name: attach.name, attach_type: attach.type, attach_size: attach.size } : {}), ...(replyTo ? { reply_to: replyTo } : {}) });
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
  if (!UUID.test(chatId) || !VOICE.test(url) || !(secs >= 1 && secs <= 900)) return { ok: false, error: "That voice note did not work." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Chats need the database, which preview mode does not have." };
  const { error } = await supabase.from("chat_posts").insert({ chat_id: chatId, author_id: session.user.id, body: "Voice note", audio_url: url, audio_secs: Math.round(secs) });
  if (error) return { ok: false, error: "We could not post that. Please try again." };
  refresh(slug);
  return { ok: true };
}

/** A voice note as a reply under a post in a feed-style chat. */
export async function replyVoice(postId: string, slug: string, url: string, secs: number): Promise<Result> {
  if (!UUID.test(postId) || !VOICE.test(url) || !(secs >= 1 && secs <= 900)) return { ok: false, error: "That voice note did not work." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("chat_comments").insert({ post_id: postId, author_id: session.user.id, body: "Voice note", audio_url: url, audio_secs: Math.round(secs) });
  if (error) return { ok: false, error: "We could not post that reply. Please try again." };
  refresh(slug);
  return { ok: true };
}

export type FwdSource = { kind: "chat" | "group" | "dm"; id: string };
export type FwdTarget = { kind: "chat" | "group" | "dm"; id: string; slug?: string };

/** Sends a copy of a message (whatever it is: words, GIF, voice note, picture or file) to another chat, group or person. */
export async function forwardMessage(src: FwdSource, dest: FwdTarget): Promise<Result> {
  if (!UUID.test(src.id) || !UUID.test(dest.id)) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Chats need the database, which preview mode does not have." };
  const me = session.user.id;
  const table = src.kind === "chat" ? "chat_posts" : src.kind === "group" ? "group_messages" : "direct_messages";
  const star = await supabase.from(table).select("*").eq("id", src.id).maybeSingle();
  const m = star.data as Record<string, string | number | null> | null;
  if (!m) return { ok: false, error: "We could not find that message." };
  const authorId = String((src.kind === "dm" ? m.sender_id : m.author_id) ?? "");
  let from = (m.forwarded_from as string | null) ?? null;
  if (!from && authorId) {
    const { data: c } = await supabase.from("profile_cards").select("first_name, last_name").eq("id", authorId).maybeSingle();
    from = [(c as { first_name: string | null } | null)?.first_name, (c as { last_name: string | null } | null)?.last_name].filter(Boolean).join(" ") || null;
  }
  let image = (m.image_url as string | null) ?? null;
  let attach: { url: string; name: string; type: string; size: number } | null = m.attach_url ? { url: String(m.attach_url), name: String(m.attach_name), type: String(m.attach_type), size: Number(m.attach_size) } : null;
  /* a picture sent in a direct message lives in the pictures folder: in a chat it travels as an attachment */
  if (image && /\/dm-pictures\//.test(image) && dest.kind !== "dm") { attach = { url: image, name: "Picture", type: "image/jpeg", size: 1 }; image = null; }
  const audio = m.audio_url ? { url: String(m.audio_url), secs: Number(m.audio_secs) } : null;
  const original = String(m.body ?? "").trim();
  const body = original || (audio ? "Voice note" : image ? "GIF" : attach ? "Attachment" : "Forwarded message");
  const payload = {
    body: dest.kind === "dm" && !original ? "" : body,
    ...(image ? { image_url: image } : {}),
    ...(audio ? { audio_url: audio.url, audio_secs: audio.secs } : {}),
    ...(attach ? { attach_url: attach.url, attach_name: attach.name, attach_type: attach.type, attach_size: attach.size } : {}),
    ...(from ? { forwarded_from: from } : {}),
  };
  const res = dest.kind === "chat" ? await supabase.from("chat_posts").insert({ chat_id: dest.id, author_id: me, ...payload })
    : dest.kind === "group" ? await supabase.from("group_messages").insert({ group_id: dest.id, author_id: me, ...payload })
    : await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: dest.id, ...payload });
  if (res.error) return { ok: false, error: res.error.code === "42501" ? "You cannot post there." : "We could not forward that. Please try again." };
  if (dest.kind === "chat" && dest.slug) refresh(dest.slug);
  revalidatePath(dest.kind === "group" ? `/groups/${dest.id}` : "/messages");
  return { ok: true };
}
