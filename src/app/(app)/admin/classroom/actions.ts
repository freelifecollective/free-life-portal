"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { parseVimeo } from "@/lib/recordings/vimeo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type R = { ok: true; id?: string } | { ok: false; error: string };
const refresh = () => { revalidatePath("/admin/classroom", "layout"); revalidatePath("/classroom", "layout"); };

const COVER = /^https:\/\/[^\s]{1,480}$/;
const coverOf = (u: string) => { const t = (u ?? "").trim(); return t && COVER.test(t) ? t : null; };

export async function createCourse(title: string, cover = ""): Promise<R> {
  const t = title.trim();
  if (!t || t.length > 120) return { ok: false, error: "Give the course a title of up to 120 characters." };
  const { supabase } = await requireAdmin();
  const { data: last } = await supabase.from("classroom_courses").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from("classroom_courses").insert({ title: t, sort: ((last as { sort: number } | null)?.sort ?? 0) + 1, ...(coverOf(cover) ? { cover_url: coverOf(cover) } : {}) }).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: "We could not create that. Please try again." };
  refresh();
  return { ok: true, id: (data as { id: string }).id };
}

export async function saveCourse(c: { id: string; title: string; description: string; audience: string; published: boolean; cover_url?: string }): Promise<R> {
  if (!UUID.test(c.id)) return { ok: false, error: "Something went wrong." };
  const title = c.title.trim();
  if (!title || title.length > 120) return { ok: false, error: "Give the course a title of up to 120 characters." };
  if (c.description.length > 1000) return { ok: false, error: "Keep the description under 1000 characters." };
  if (c.audience !== "everyone" && c.audience !== "affiliates") return { ok: false, error: "Choose who can see the course." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("classroom_courses").update({ title, description: c.description.trim() || null, audience: c.audience, published: !!c.published, cover_url: coverOf(c.cover_url ?? "") }).eq("id", c.id);
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  refresh();
  return { ok: true };
}

export async function deleteCourse(id: string): Promise<R> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("classroom_courses").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not delete that." };
  refresh();
  return { ok: true };
}

async function move(table: "classroom_courses" | "classroom_lessons", id: string, dir: -1 | 1, scope?: { col: string; val: string }): Promise<R> {
  const { supabase } = await requireAdmin();
  let q = supabase.from(table).select("id").order("sort").order("created_at");
  if (scope) q = q.eq(scope.col, scope.val);
  const { data } = await q;
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((x, k) => supabase.from(table).update({ sort: k + 1 }).eq("id", x)));
  refresh();
  return { ok: true };
}
export async function moveCourse(id: string, dir: -1 | 1): Promise<R> { return UUID.test(id) ? move("classroom_courses", id, dir) : { ok: false, error: "Something went wrong." }; }
export async function moveLesson(id: string, courseId: string, dir: -1 | 1): Promise<R> { return UUID.test(id) && UUID.test(courseId) ? move("classroom_lessons", id, dir, { col: "course_id", val: courseId }) : { ok: false, error: "Something went wrong." }; }

export async function saveLesson(l: { id?: string; courseId: string; title: string; vimeo: string; body: string; published: boolean }): Promise<R> {
  if (!UUID.test(l.courseId) || (l.id && !UUID.test(l.id))) return { ok: false, error: "Something went wrong." };
  const title = l.title.trim();
  if (!title || title.length > 120) return { ok: false, error: "Give the lesson a title of up to 120 characters." };
  if (l.body.length > 8000) return { ok: false, error: "Keep the notes under 8000 characters." };
  let vimeo: { id: string; hash: string | null } | null = null;
  if (l.vimeo.trim()) {
    vimeo = parseVimeo(l.vimeo);
    if (!vimeo) return { ok: false, error: "Paste the Vimeo link of the video (it looks like https://vimeo.com/123456789)." };
  }
  const row = { title, body: l.body.trim() || null, vimeo_id: vimeo?.id ?? null, vimeo_hash: vimeo?.hash ?? null, published: !!l.published };
  const { supabase } = await requireAdmin();
  if (l.id) {
    const { error } = await supabase.from("classroom_lessons").update(row).eq("id", l.id);
    if (error) return { ok: false, error: "We could not save that. Please try again." };
  } else {
    const { data: last } = await supabase.from("classroom_lessons").select("sort").eq("course_id", l.courseId).order("sort", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("classroom_lessons").insert({ ...row, course_id: l.courseId, sort: ((last as { sort: number } | null)?.sort ?? 0) + 1 });
    if (error) return { ok: false, error: "We could not save that. Please try again." };
  }
  refresh();
  return { ok: true };
}

export async function deleteLesson(id: string): Promise<R> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("classroom_lessons").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not delete that." };
  refresh();
  return { ok: true };
}
