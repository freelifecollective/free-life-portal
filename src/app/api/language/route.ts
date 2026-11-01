import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OK = new Set(["en", "es", "fr", "it", "de"]);

/** Remembers the language a signed-in person picked, so notifications reach them in it. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { lang?: unknown } | null;
  const lang = typeof body?.lang === "string" ? body.lang : "";
  if (!OK.has(lang)) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false }, { status: 401 });
  await supabase.from("profiles").update({ lang }).eq("id", data.user.id);
  return NextResponse.json({ ok: true });
}
