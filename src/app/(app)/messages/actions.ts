"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

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
