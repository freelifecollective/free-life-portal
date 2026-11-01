"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { validAttach, type Attach } from "@/lib/chats/attach";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MessageState = { error: string; sent?: number };

export async function sendMessage(otherId: string, prev: MessageState, form: FormData): Promise<MessageState> {
  const body = String(form.get("body") ?? "").trim();
  if (!UUID.test(otherId)) return { error: "Something went wrong." };
  if (!body) return { error: "Write a message first." };
  if (body.length > 4000) return { error: "Please keep messages under 4000 characters." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { error: "Messages need the database." };
  const { error } = await supabase.from("direct_messages").insert({ sender_id: session.user.id, recipient_id: otherId, body });
  if (error) return { error: error.code === "42501" ? "You cannot message this person." : "We could not send that. Please try again." };
  revalidatePath("/messages");
  return { error: "", sent: (prev.sent ?? 0) + 1 };
}

/** Called only when someone actually opens a conversation. Peeking from the list never calls this. */
export async function markConversationRead(otherId: string): Promise<void> {
  if (!UUID.test(otherId)) return;
  const { supabase } = await requireMember();
  await supabase?.rpc("mark_conversation_read", { p_other: otherId });
  revalidatePath("/", "layout");
}

const VOICE = /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/voice-notes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|m4a|ogg)$/i;

/** Sends a voice note that has already been uploaded. */
export async function sendVoiceMessage(otherId: string, url: string, secs: number): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(otherId) || !VOICE.test(url) || !(secs >= 1 && secs <= 900)) return { ok: false, error: "That voice note did not work." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Messages need the database." };
  const { error } = await supabase.from("direct_messages").insert({ sender_id: session.user.id, recipient_id: otherId, body: "", audio_url: url, audio_secs: Math.round(secs) });
  if (error) return { ok: false, error: error.code === "42501" ? "You cannot message this person." : "We could not send that. Please try again." };
  revalidatePath("/messages");
  return { ok: true };
}

/** Sends a file that has already been uploaded. */
export async function sendFileMessage(otherId: string, attach: Attach): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(otherId) || !validAttach(attach)) return { ok: false, error: "That file did not work." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Messages need the database." };
  const { error } = await supabase.from("direct_messages").insert({ sender_id: session.user.id, recipient_id: otherId, body: "", attach_url: attach.url, attach_name: attach.name, attach_type: attach.type, attach_size: attach.size });
  if (error) return { ok: false, error: error.code === "42501" ? "You cannot message this person." : "We could not send that. Please try again." };
  revalidatePath("/messages");
  return { ok: true };
}
