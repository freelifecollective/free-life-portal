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

/** Best effort: Canva's own name (and preview picture) for a link. Tries Canva's oEmbed first, then the page's own title. Nothing is lost if Canva does not answer. */
async function canvaInfo(url: string): Promise<{ image: string | null; title: string | null }> {
  const clean = (t: string) => t.replace(/\s*[-|–—]\s*Canva\s*$/i, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim().slice(0, 160);
  try {
    const r = await fetch(`https://www.canva.com/_oembed?url=${encodeURIComponent(url)}&format=json`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { thumbnail_url?: unknown; title?: unknown };
      const image = typeof j.thumbnail_url === "string" && /^https:\/\/\S+$/.test(j.thumbnail_url) ? j.thumbnail_url : null;
      const title = typeof j.title === "string" && clean(j.title) ? clean(j.title) : null;
      if (title || image) return { image, title };
    }
  } catch { /* try the page itself */ }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store", headers: { "user-agent": "Mozilla/5.0 (compatible; FLCPortal/1.0)", accept: "text/html" } });
    if (!r.ok) return { image: null, title: null };
    const html = (await r.text()).slice(0, 200000);
    const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html) ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html) ?? /<title>([^<]+)<\/title>/i.exec(html);
    const img = /<meta[^>]+property=["']og:image["'][^>]+content=["'](https:\/\/[^"']+)["']/i.exec(html);
    const title = og && clean(og[1]) && !/^canva$/i.test(clean(og[1])) ? clean(og[1]) : null;
    return { image: img ? img[1].replace(/&amp;/g, "&").slice(0, 1000) : null, title };
  } catch { return { image: null, title: null }; }
}

/** Gives every template still called "Canva template N" its real name from Canva (names you typed yourself are left alone). */
export async function refreshCanvaNames(): Promise<AddState> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("resource_items").select("id, title, url, image_url").eq("category", "canva").limit(500);
  const todo = ((data ?? []) as { id: string; title: string; url: string; image_url: string | null }[]).filter((r) => /^Canva template \d+$/.test(r.title)).slice(0, 40);
  if (todo.length === 0) return { error: "", done: "Every template already has its own name." };
  let named = 0;
  for (const r of todo) {
    const info = await canvaInfo(r.url);
    if (!info.title) continue;
    const { error } = await supabase.from("resource_items").update({ title: info.title, ...(info.image && !r.image_url && !canvaEmbedUrl(r.url) ? { image_url: info.image } : {}) }).eq("id", r.id);
    if (!error) named++;
  }
  revalidatePath("/admin/resource-library"); revalidatePath("/advertising/canva-templates");
  if (named === 0) return { error: "Canva did not share the names. You can type them in yourself: delete a template and add it again with its name in front of the link.", done: "" };
  return { error: "", done: `Got ${named} of ${todo.length} names from Canva.${named < todo.length ? " The rest keep their number for now." : ""}` };
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

/** Change a saved item's name, link, picture or description. */
export async function updateResource(id: string, v: { title: string; url: string; image_url: string; description: string }): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const title = String(v.title ?? "").trim();
  const url = String(v.url ?? "").trim();
  const image = String(v.image_url ?? "").trim();
  const description = String(v.description ?? "").trim();
  if (!title || title.length > 160) return { ok: false, error: "Give it a name of up to 160 characters." };
  if (!/^https:\/\/\S+$/.test(url) || url.length > 1000) return { ok: false, error: "The link must start with https://" };
  if (image && (!/^https:\/\/\S+$/.test(image) || image.length > 1000)) return { ok: false, error: "The picture link must start with https://" };
  if (description.length > 600) return { ok: false, error: "Keep the description under 600 characters." };
  const { error } = await supabase.from("resource_items").update({ title, url, image_url: image || null, description: description || null }).eq("id", id);
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath("/admin/resource-library"); revalidatePath("/admin/canva-templates");
  for (const t of RESOURCE_TABS) revalidatePath(`/${t.section}/${t.slug}`);
  return { ok: true };
}
