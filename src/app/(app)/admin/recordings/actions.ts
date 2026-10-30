"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { isTopic, LEAD_TOPIC } from "@/lib/recordings/topics";
import { parseTime, parseVimeo } from "@/lib/recordings/vimeo";
import { zonedToUtc } from "@/lib/time";

const UUID = /^[0-9a-f-]{36}$/i;
export type RecordingState = { error: string; saved?: boolean };
const refresh = () => { revalidatePath("/calls"); revalidatePath("/admin/recordings"); };

/** The picture and length come from Vimeo's public information (best effort: a private video just has no picture). */
async function vimeoMeta(url: string): Promise<{ thumb: string | null; duration: number | null; title: string | null }> {
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=640`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { thumb: null, duration: null, title: null };
    const j = (await r.json()) as { thumbnail_url?: string; duration?: number; title?: string };
    return { thumb: j.thumbnail_url?.startsWith("https://") ? j.thumbnail_url : null, duration: Number.isFinite(j.duration) ? Math.round(j.duration!) : null, title: j.title ?? null };
  } catch { return { thumb: null, duration: null, title: null }; }
}

export async function saveRecording(id: string | null, _prev: RecordingState, form: FormData): Promise<RecordingState> {
  const url = String(form.get("url") ?? "").trim();
  const v = parseVimeo(url);
  if (!v) return { error: "Paste the Vimeo link of the video (it looks like https://vimeo.com/123456789)." };
  let title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const callId = String(form.get("call_id") ?? "");
  const when = String(form.get("recorded_at") ?? "");
  const start = parseTime(String(form.get("start") ?? ""));
  const end = parseTime(String(form.get("end") ?? ""));
  if (start === undefined || end === undefined) return { error: "Times look like 5:30 or 1:05:30." };
  if (end !== null && end <= (start ?? 0)) return { error: "The end time must be after the start time." };
  if (description.length > 2000) return { error: "Keep the description under 2000 characters." };
  const topics = form.getAll("topics").map(String).filter(isTopic);
  const { session, supabase } = await requireAdmin();
  const meta = await vimeoMeta(url);
  if (!title) title = meta.title ?? "";
  if (!title || title.length > 160) return { error: "Add a title of up to 160 characters." };
  const row = {
    title, description: description || null, vimeo_id: v.id, vimeo_hash: v.hash,
    call_id: UUID.test(callId) ? callId : null,
    recorded_at: (/^\d{4}-\d{2}-\d{2}$/.test(when) ? zonedToUtc(`${when}T12:00`) : null)?.toISOString() ?? new Date().toISOString(),
    start_secs: start ?? 0, end_secs: end,
    topics, for_leads: form.get("for_leads") === "on" || topics.includes(LEAD_TOPIC), for_downline: form.get("for_downline") === "on", published: form.get("published") === "on",
    ...(meta.thumb ? { thumb_url: meta.thumb } : {}), ...(meta.duration ? { duration_secs: meta.duration } : {}),
  };
  const { error } = id && UUID.test(id) ? await supabase.from("recordings").update(row).eq("id", id) : await supabase.from("recordings").insert({ ...row, created_by: session.user.id });
  if (error) return { error: "We could not save that recording. Please check the details." };
  refresh();
  return { error: "", saved: true };
}

export async function deleteRecording(id: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("recordings").delete().eq("id", id);
  refresh();
  return { ok: !error };
}

export async function setPublished(id: string, published: boolean): Promise<{ ok: boolean }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("recordings").update({ published }).eq("id", id);
  refresh();
  return { ok: !error };
}
