"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { AUDIENCES, CALL_KINDS, type Audience, type CallKind } from "@/lib/calls/types";
import { SUPABASE_URL } from "@/lib/env";
import { zonedToUtc } from "@/lib/time";

export type CallFormState = { error: string };

type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

function parse(form: FormData): Parsed {
  const title = String(form.get("title") ?? "").trim();
  const kind = String(form.get("kind") ?? "") as CallKind;
  const audience = String(form.get("audience") ?? "") as Audience;
  const starts = zonedToUtc(String(form.get("starts") ?? ""));
  const duration = Number(form.get("duration"));
  const description = String(form.get("description") ?? "").trim();
  const joinUrl = String(form.get("join_url") ?? "").trim();
  const host = String(form.get("host") ?? "").trim();
  if (!title || title.length > 120) return { ok: false, error: "Give the call a title of up to 120 characters." };
  if (!CALL_KINDS.includes(kind)) return { ok: false, error: "Choose what kind of call it is." };
  if (!AUDIENCES.includes(audience)) return { ok: false, error: "Choose who the call is for." };
  if (!starts) return { ok: false, error: "Enter a start date and time. If you did, that time does not exist because the clocks change (try an hour later)." };
  if (!Number.isInteger(duration) || duration < 15 || duration > 480) return { ok: false, error: "The length must be between 15 and 480 minutes." };
  if (host.length > 80) return { ok: false, error: "Keep the name of who is leading the call under 80 characters." };
  if (description.length > 2000) return { ok: false, error: "Keep the description under 2000 characters." };
  if (joinUrl && !/^https:\/\/\S+$/.test(joinUrl)) return { ok: false, error: "The join link must start with https://" };
  return {
    ok: true,
    value: { title, kind, audience, starts_at: starts.toISOString(), duration_minutes: duration, description: description || null, join_url: joinUrl || null, host: host || null, pinned: form.get("pinned") === "on" },
  };
}

const SPEAKER_PHOTOS = `${SUPABASE_URL}/storage/v1/object/public/speakers/`;

/** The speakers typed into the form, in order (blank names dropped, pictures only from our own storage). */
function speakersFrom(form: FormData): { name: string; photo_url: string | null; position: number }[] {
  const names = form.getAll("speaker_name").map(String);
  const photos = form.getAll("speaker_photo").map(String);
  const out: { name: string; photo_url: string | null; position: number }[] = [];
  names.forEach((n, i) => {
    const name = n.trim().slice(0, 80);
    const photo = (photos[i] ?? "").trim();
    if (name && out.length < 6) out.push({ name, photo_url: photo.startsWith(SPEAKER_PHOTOS) && photo.length < 400 ? photo : null, position: out.length });
  });
  return out;
}

async function saveSpeakers(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], callId: string, form: FormData) {
  await supabase.from("call_speakers").delete().eq("call_id", callId);
  const rows = speakersFrom(form).map((s) => ({ ...s, call_id: callId }));
  if (rows.length) await supabase.from("call_speakers").insert(rows);
}

export async function createCall(_prev: CallFormState, form: FormData): Promise<CallFormState> {
  const { session, supabase } = await requireAdmin();
  const p = parse(form);
  if (!p.ok) return { error: p.error };
  const { data: made, error } = await supabase.from("calls").insert({ ...p.value, created_by: session.user.id }).select("id").single();
  if (error || !made) return { error: "We could not save the call. Please try again." };
  await saveSpeakers(supabase, made.id, form);
  revalidatePath("/calendar"); revalidatePath("/admin/calls"); revalidatePath("/");
  redirect("/admin/calls");
}

export async function updateCall(id: string, _prev: CallFormState, form: FormData): Promise<CallFormState> {
  const { supabase } = await requireAdmin();
  const p = parse(form);
  if (!p.ok) return { error: p.error };
  const { error } = await supabase.from("calls").update(p.value).eq("id", id);
  if (error) return { error: "We could not save the changes. Please try again." };
  await saveSpeakers(supabase, id, form);
  revalidatePath("/calendar"); revalidatePath("/admin/calls"); revalidatePath("/");
  redirect("/admin/calls");
}

export async function deleteCall(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  await supabase.from("calls").delete().eq("id", id);
  revalidatePath("/calendar"); revalidatePath("/admin/calls"); revalidatePath("/");
  redirect("/admin/calls");
}
