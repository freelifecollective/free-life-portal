"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

/** Pressing Join: records that you came (when the call is on) and returns the link to open. */
export async function joinCall(callId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { data, error } = await supabase.rpc("join_call", { p_call: callId });
  if (error || !data) return { ok: false, error: "This call has no join link yet." };
  return { ok: true, url: String(data) };
}

export async function submitFeedback(callId: string, thoughts: string, favourite: string, takeaway: string): Promise<{ ok: boolean; error?: string }> {
  const t = thoughts.trim(), f = favourite.trim(), k = takeaway.trim();
  if (!/^[0-9a-f-]{36}$/i.test(callId) || !t || !f || !k) return { ok: false, error: "Please answer all three questions." };
  if ([t, f, k].some((x) => x.length > 1500)) return { ok: false, error: "Please keep each answer under 1500 characters." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("call_feedback").insert({ call_id: callId, user_id: session.user.id, thoughts: t, favourite: f, takeaway: k });
  if (error) return { ok: false, error: error.code === "23505" ? "You already shared your feedback. Thank you!" : "We could not save that. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export type FeedbackRow = { first_name: string | null; last_name: string | null; avatar_url: string | null; thoughts: string; favourite: string; takeaway: string; created_at: string };
export async function loadFeedback(callId: string): Promise<{ ok: boolean; rows: FeedbackRow[] }> {
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return { ok: false, rows: [] };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, rows: [] };
  const { data } = await supabase.rpc("call_feedback_all", { p_call: callId });
  return { ok: true, rows: (data ?? []) as FeedbackRow[] };
}

/** Notes that someone pressed play on a recording, so the person who invited them can see who watched the replay. */
export async function markWatched(recordingId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(recordingId)) return;
  const { session, supabase } = await requireMember();
  if (!supabase) return;
  await supabase.from("recording_views").upsert({ user_id: session.user.id, recording_id: recordingId }, { onConflict: "user_id,recording_id", ignoreDuplicates: true });
}
