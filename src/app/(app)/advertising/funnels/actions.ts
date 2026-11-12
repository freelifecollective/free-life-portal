"use server";

import { revalidatePath } from "next/cache";
import { requirePlan } from "@/lib/auth/guards";
import { emptyPage, optInPage, sanitizePage, slugify, thankYouPage } from "@/lib/funnels/types";

export type Result = { ok: boolean; error?: string; id?: string; slug?: string };
const UUID = /^[0-9a-f-]{36}$/i;
const done = (id?: string): Result => { revalidatePath("/advertising/funnels"); return { ok: true, id }; };

/** A new funnel: blank (one empty page) or ready-made (an opt-in page and a thank-you page). */
export async function createFunnel(name: string, template: "blank" | "optin"): Promise<Result> {
  const { session, supabase } = await requirePlan(97);
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, error: "Give your funnel a name." };
  const { data: taken } = await supabase.from("funnels").select("slug").eq("owner_id", session.user.id);
  const used = new Set((taken ?? []).map((t: { slug: string }) => t.slug));
  const base = slugify(clean).slice(0, 44);
  let slug = base, n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  const { data: f, error } = await supabase.from("funnels").insert({ owner_id: session.user.id, name: clean, slug }).select("id").single();
  if (error || !f) return { ok: false, error: "We could not create your funnel. Please try again." };
  const steps = template === "optin"
    ? [{ funnel_id: f.id, position: 0, name: "Opt-in page", slug: "optin", page: optInPage() }, { funnel_id: f.id, position: 1, name: "Thank you page", slug: "thank-you", page: thankYouPage() }]
    : [{ funnel_id: f.id, position: 0, name: "Page 1", slug: "page-1", page: emptyPage() }];
  const { error: e2 } = await supabase.from("funnel_steps").insert(steps);
  if (e2) return { ok: false, error: "We could not create your funnel's pages. Please try again." };
  return done(f.id);
}

export async function renameFunnel(id: string, name: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  const clean = name.trim().slice(0, 80);
  if (!UUID.test(id) || !clean) return { ok: false, error: "Give your funnel a name." };
  const { error } = await supabase.from("funnels").update({ name: clean, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { ok: false, error: "We could not rename it." } : done(id);
}

export async function deleteFunnel(id: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(id)) return { ok: false };
  const { error } = await supabase.from("funnels").delete().eq("id", id);
  return error ? { ok: false, error: "We could not delete it." } : done();
}

/** A copy of a funnel with all its pages, named "… (copy)". */
export async function duplicateFunnel(id: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(id)) return { ok: false };
  const { data: f } = await supabase.from("funnels").select("name").eq("id", id).single();
  const { data: steps } = await supabase.from("funnel_steps").select("position, name, slug, page").eq("funnel_id", id).order("position");
  if (!f) return { ok: false };
  const r = await createFunnel(`${f.name} (copy)`.slice(0, 80), "blank");
  if (!r.ok || !r.id) return r;
  await supabase.from("funnel_steps").delete().eq("funnel_id", r.id);
  if (steps?.length) await supabase.from("funnel_steps").insert(steps.map((s) => ({ ...s, funnel_id: r.id })));
  return done(r.id);
}

/** Saves one page of a funnel. The page is checked and cleaned first. */
export async function saveStep(stepId: string, page: unknown): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(stepId)) return { ok: false };
  const clean = sanitizePage(page);
  if (JSON.stringify(clean).length > 350_000) return { ok: false, error: "This page is too big to save. Try removing some sections." };
  const { error } = await supabase.from("funnel_steps").update({ page: clean, updated_at: new Date().toISOString() }).eq("id", stepId);
  return error ? { ok: false, error: "We could not save. Check your connection and try again." } : { ok: true };
}

/** Adds a page (step) to the end of a funnel. */
export async function addStep(funnelId: string, name: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  const clean = name.trim().slice(0, 80);
  if (!UUID.test(funnelId) || !clean) return { ok: false, error: "Give the page a name." };
  const { data: steps } = await supabase.from("funnel_steps").select("slug, position").eq("funnel_id", funnelId);
  if ((steps?.length ?? 0) >= 30) return { ok: false, error: "A funnel can have up to 30 pages." };
  const used = new Set((steps ?? []).map((s) => s.slug));
  const base = slugify(clean).slice(0, 44);
  let slug = base, n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  const position = Math.max(-1, ...(steps ?? []).map((s) => s.position)) + 1;
  const { data, error } = await supabase.from("funnel_steps").insert({ funnel_id: funnelId, position, name: clean, slug, page: emptyPage() }).select("id").single();
  return error || !data ? { ok: false, error: "We could not add the page." } : { ...done(data.id), slug };
}

export async function renameStep(stepId: string, name: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  const clean = name.trim().slice(0, 80);
  if (!UUID.test(stepId) || !clean) return { ok: false, error: "Give the page a name." };
  const { error } = await supabase.from("funnel_steps").update({ name: clean }).eq("id", stepId);
  return error ? { ok: false, error: "We could not rename the page." } : done();
}

export async function deleteStep(stepId: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(stepId)) return { ok: false };
  const { data: s } = await supabase.from("funnel_steps").select("funnel_id").eq("id", stepId).single();
  if (!s) return { ok: false };
  const { count } = await supabase.from("funnel_steps").select("id", { count: "exact", head: true }).eq("funnel_id", s.funnel_id);
  if ((count ?? 0) <= 1) return { ok: false, error: "A funnel needs at least one page." };
  const { error } = await supabase.from("funnel_steps").delete().eq("id", stepId);
  return error ? { ok: false, error: "We could not delete the page." } : done();
}

/** Moves a page one place earlier or later in its funnel. */
export async function moveStep(stepId: string, dir: -1 | 1): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(stepId)) return { ok: false };
  const { data: me } = await supabase.from("funnel_steps").select("funnel_id").eq("id", stepId).single();
  if (!me) return { ok: false };
  const { data: steps } = await supabase.from("funnel_steps").select("id, position").eq("funnel_id", me.funnel_id).order("position");
  const list = steps ?? [];
  const i = list.findIndex((s) => s.id === stepId), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) await supabase.from("funnel_steps").update({ position: k }).eq("id", list[k].id);
  return done();
}
