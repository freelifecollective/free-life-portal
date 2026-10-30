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

/** Remembers how far someone got through a recording (0 to 100). Past 80% it counts as watched, which earns replay badges. */
export async function recordView(recordingId: string, pct: number): Promise<{ new: string[] }> {
  if (!/^[0-9a-f-]{36}$/i.test(recordingId) || !Number.isFinite(pct)) return { new: [] };
  const { supabase } = await requireMember();
  if (!supabase) return { new: [] };
  await supabase.rpc("record_view", { p_recording: recordingId, p_pct: Math.round(pct) });
  if (pct < 80) return { new: [] };
  const { data } = await supabase.rpc("badge_state");
  return { new: Array.isArray(data?.new) ? (data.new as string[]) : [] };
}

/** "Don't ask me again for this call": the feedback popup will not come back for it. */
export async function dismissFeedback(callId: string): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(callId)) return { ok: false };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("feedback_dismissed").upsert({ user_id: session.user.id, call_id: callId }, { onConflict: "user_id,call_id", ignoreDuplicates: true });
  return { ok: !error };
}
