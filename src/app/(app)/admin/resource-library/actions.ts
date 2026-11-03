"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { canvaEmbedUrl } from "@/lib/resources/canva";
import { RESOURCE_TABS } from "@/lib/resources/kinds";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type AddState = { error: string; done: string };

export async function addResource(_p: AddState, form: FormData): Promise<AddState> {
  const { supabase } = await requireAdmin();
  const category = String(form.get("category") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const image = String(form.get("image_url") ?? "").trim();
  if (!RESOURCE_TABS.some((t) => t.category === category)) return { error: "Choose where it goes.", done: "" };
  if (!title || title.length > 160) return { error: "Give it a title of up to 160 characters.", done: "" };
  if (!/^https:\/\/\S+$/.test(url)) return { error: "The link must start with https://", done: "" };
  if (image && !/^https:\/\/\S+$/.test(image)) return { error: "The picture link must start with https://", done: "" };
  if (description.length > 600) return { error: "Keep the description under 600 characters.", done: "" };
  const { error } = await supabase.from("resource_items").insert({ category, title, description: description || null, url, image_url: image || null });
  if (error) return { error: "We could not save that. Please try again.", done: "" };
  revalidatePath("/admin/resource-library");
  return { error: "", done: `Added “${title}”.` };
}

export async function deleteResource(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("resource_items").delete().eq("id", id);
  revalidatePath("/admin/resource-library");
}

/** Best effort: Canva's own preview picture and name for a link (nothing is lost if Canva does not answer). */
async function canvaInfo(url: string): Promise<{ image: string | null; title: string | null }> {
  try {
    const r = await fetch(`https://www.canva.com/_oembed?url=${encodeURIComponent(url)}&format=json`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!r.ok) return { image: null, title: null };
    const j = (await r.json()) as { thumbnail_url?: unknown; title?: unknown };
    const image = typeof j.thumbnail_url === "string" && /^https:\/\/\S+$/.test(j.thumbnail_url) ? j.thumbnail_url : null;
    const title = typeof j.title === "string" && j.title.trim() ? j.title.trim().slice(0, 160) : null;
    return { image, title };
  } catch { return { image: null, title: null }; }
}

/** Paste many Canva links at once (one per line, with an optional name before the link). Each becomes a template card with a preview. */
export async function addCanvaLinks(_p: AddState, form: FormData): Promise<AddState> {
  const { supabase } = await requireAdmin();
  const text = String(form.get("links") ?? "").slice(0, 60000);
  const found: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /(https:\/\/(?:www\.)?(?:canva\.com|canva\.link)\/[^\s<>"')\]]+)/i.exec(line);
    if (!m) continue;
    const url = m[1].replace(/[.,;]+$/, "");
    if (url.length > 1000 || seen.has(url)) continue;
    seen.add(url);
    found.push({ url, title: line.replace(m[1], "").replace(/^[\s\-–—:•*\d.)]+|[\s\-–—:]+$/g, "").trim().slice(0, 160) });
  }
  if (found.length === 0) return { error: "I could not find any Canva links in that. Paste the links, one per line.", done: "" };
  if (found.length > 200) return { error: "Please add up to 200 links at a time.", done: "" };
  const { data: have } = await supabase.from("resource_items").select("url").eq("category", "canva").limit(2000);
  const existing = new Set(((have ?? []) as { url: string }[]).map((r) => r.url));
  const fresh = found.filter((f) => !existing.has(f.url));
  const rows = [];
  let n = 0;
  for (const f of fresh) {
    n++;
    const info = canvaEmbedUrl(f.url) ? { image: null, title: null } : await canvaInfo(f.url);
    rows.push({ category: "canva", title: f.title || info.title || `Canva template ${n}`, description: null, url: f.url, image_url: info.image });
  }
  if (rows.length) {
    const { error } = await supabase.from("resource_items").insert(rows);
    if (error) return { error: "We could not save those. Please try again.", done: "" };
  }
  revalidatePath("/admin/resource-library"); revalidatePath("/advertising/canva-templates");
  const skipped = found.length - fresh.length;
  return { error: "", done: `Added ${rows.length} template${rows.length === 1 ? "" : "s"}${skipped ? ` (${skipped} already on the page, skipped)` : ""}.` };
}
