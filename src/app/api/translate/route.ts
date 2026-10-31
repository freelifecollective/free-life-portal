import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LANGS = new Set(["en", "es", "fr", "it", "de"]);
const cache = new Map<string, { text: string; same: boolean }>();

/** Translates what members write (posts, replies, messages) with Google Translate. Only signed-in people can use it. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { text?: unknown; to?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
  const to = typeof body.to === "string" ? body.to : "";
  if (!text.trim() || !LANGS.has(to)) return NextResponse.json({ ok: false }, { status: 400 });
  const key = to + "\n" + text;
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ ok: true, ...hit });
  try {
    const res = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + to + "&dt=t", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "q=" + encodeURIComponent(text),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ ok: false });
    const json = (await res.json()) as [Array<[string]> | null, unknown, string?];
    const out = (json[0] ?? []).map((s) => s?.[0] ?? "").join("");
    const same = json[2] === to || !out.trim();
    const value = { text: same ? text : out, same };
    if (cache.size > 3000) cache.clear();
    cache.set(key, value);
    return NextResponse.json({ ok: true, ...value });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
