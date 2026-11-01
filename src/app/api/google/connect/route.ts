import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";

const BACK = new Set(["/call-closer", "/settings/availability"]);

/** Sends a signed-in member to Google to allow the portal to see when they are busy. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  const back = BACK.has(req.nextUrl.searchParams.get("from") ?? "") ? req.nextUrl.searchParams.get("from")! : "/call-closer";
  if (!googleConfigured) return NextResponse.redirect(new URL(`${back}?google=notset`, req.nextUrl.origin));
  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authUrl(`${req.nextUrl.origin}/api/google/callback`, state));
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/api/google", maxAge: 600 };
  res.cookies.set("flc_g_state", state, opts);
  res.cookies.set("flc_g_back", back, opts);
  return res;
}
