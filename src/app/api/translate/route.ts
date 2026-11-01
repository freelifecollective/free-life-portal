import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleTranslate } from "@/lib/translate";

const LANGS = new Set(["en", "es", "fr", "it", "de"]);

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
  const r = await googleTranslate(text, to);
  return NextResponse.json(r ? { ok: true, ...r } : { ok: false });
}
