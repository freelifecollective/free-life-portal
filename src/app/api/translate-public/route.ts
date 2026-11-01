import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleTranslate } from "@/lib/translate";

const LANGS = new Set(["en", "es", "fr", "it", "de"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Translates the title or description of a call that anyone can see (landing and sign-up pages). It can only translate those two texts, never anything sent in. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { callId?: unknown; field?: unknown; to?: unknown } | null;
  const callId = typeof body?.callId === "string" && UUID.test(body.callId) ? body.callId : "";
  const field = body?.field === "title" || body?.field === "description" ? body.field : "";
  const to = typeof body?.to === "string" && LANGS.has(body.to) ? body.to : "";
  if (!callId || !field || !to) return NextResponse.json({ ok: false }, { status: 400 });
  const { data } = await (await createClient()).rpc("public_call", { p_call: callId });
  const text = (data as { title?: string; description?: string | null } | null)?.[field];
  if (!text) return NextResponse.json({ ok: false });
  const r = await googleTranslate(text.slice(0, 4000), to);
  return NextResponse.json(r ? { ok: true, ...r } : { ok: false });
}
