import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";

const BACK = new Set(["/call-closer", "/settings/availability"]);

/** Google sends the member back here. We keep the link (never shown to anyone) and return them to where they were. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const backCookie = req.cookies.get("flc_g_back")?.value ?? "";
  const back = BACK.has(backCookie) ? backCookie : "/call-closer";
  const done = (flag: string) => { const r = NextResponse.redirect(new URL(`${back}?google=${flag}`, origin)); r.cookies.delete("flc_g_state"); r.cookies.delete("flc_g_back"); return r; };
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !state || state !== req.cookies.get("flc_g_state")?.value) return done("failed");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", origin));
  const linked = await exchangeCode(code, `${origin}/api/google/callback`);
  if (!linked) return done("failed");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (!admin) return done("failed");
  const { error } = await admin.from("google_calendar_links").upsert({ member_id: data.user.id, refresh_token: linked.refresh, email: linked.email }, { onConflict: "member_id" });
  return done(error ? "failed" : "connected");
}
