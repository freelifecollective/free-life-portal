"use server";

import { revalidatePath } from "next/cache";
import { requirePlan } from "@/lib/auth/guards";
import { slugify } from "@/lib/funnels/types";
import { toEmbedUrl } from "@/lib/landing/video";

export type Result = { ok: boolean; error?: string; id?: string };
const UUID = /^[0-9a-f-]{36}$/i;
const CURRENCIES = ["usd", "cad", "eur", "gbp", "aud"];

export async function createCourse(title: string): Promise<Result> {
  const { session, supabase } = await requirePlan(97);
  const clean = title.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Give your course a name." };
  const { data: taken } = await supabase.from("member_courses").select("slug").eq("owner_id", session.user.id);
  const used = new Set((taken ?? []).map((t: { slug: string }) => t.slug));
  const base = slugify(clean).slice(0, 44);
  let slug = base, n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  const { data, error } = await supabase.from("member_courses").insert({ owner_id: session.user.id, title: clean, slug }).select("id").single();
  revalidatePath("/my-courses");
  return error || !data ? { ok: false, error: "We could not create your course." } : { ok: true, id: data.id };
}

export type CourseInput = { title: string; description: string; cover_url: string | null; price: string; currency: string; published: boolean };

export async function saveCourse(id: string, c: CourseInput): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(id)) return { ok: false };
  const title = c.title.trim().slice(0, 120);
  if (!title) return { ok: false, error: "Give your course a name." };
  const priceNum = c.price.trim() ? Number(c.price.replace(/[^0-9.]/g, "")) : null;
  if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 1 || priceNum > 100000)) return { ok: false, error: "Set a price between 1 and 100,000, or leave it empty." };
  const cover = c.cover_url && /^https:\/\//.test(c.cover_url) && c.cover_url.length <= 300 ? c.cover_url : null;
  const { error } = await supabase.from("member_courses").update({
    title, description: c.description.trim().slice(0, 4000) || null, cover_url: cover,
    price_cents: priceNum === null ? null : Math.round(priceNum * 100), currency: CURRENCIES.includes(c.currency) ? c.currency : "usd",
    published: !!c.published, updated_at: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath("/my-courses"); revalidatePath(`/my-courses/${id}`);
  return error ? { ok: false, error: "We could not save your course." } : { ok: true };
}

export async function deleteCourse(id: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(id)) return { ok: false };
  const { error } = await supabase.from("member_courses").delete().eq("id", id);
  revalidatePath("/my-courses");
  return { ok: !error };
}

export type LessonInput = { id?: string; title: string; body: string; video: string; free_preview: boolean };

/** Saves every lesson of a course in the order given (lessons left out are deleted). */
export async function saveLessons(courseId: string, lessons: LessonInput[]): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(courseId)) return { ok: false };
  if (lessons.length > 500) return { ok: false, error: "A course can have up to 500 lessons." };
  const rows = [];
  for (const [i, l] of lessons.entries()) {
    const title = l.title.trim().slice(0, 120);
    if (!title) return { ok: false, error: `Lesson ${i + 1} needs a title.` };
    const video = l.video.trim() ? toEmbedUrl(l.video) : null;
    if (l.video.trim() && !video) return { ok: false, error: `Lesson ${i + 1}: paste a Vimeo or YouTube link.` };
    rows.push({ ...(l.id && UUID.test(l.id) ? { id: l.id } : {}), course_id: courseId, position: i, title, body: l.body.trim().slice(0, 20000) || null, video_url: video, free_preview: !!l.free_preview });
  }
  const { data: existing } = await supabase.from("member_lessons").select("id").eq("course_id", courseId);
  const keep = new Set(rows.flatMap((r) => ("id" in r && r.id ? [r.id as string] : [])));
  const gone = (existing ?? []).map((e: { id: string }) => e.id).filter((x) => !keep.has(x));
  if (gone.length) await supabase.from("member_lessons").delete().in("id", gone);
  if (rows.length) {
    const { error } = await supabase.from("member_lessons").upsert(rows);
    if (error) return { ok: false, error: "We could not save your lessons." };
  }
  revalidatePath(`/my-courses/${courseId}`);
  return { ok: true };
}
