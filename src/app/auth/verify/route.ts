import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite"];

/** Uses the one-time login link. It works in any browser or app (it does not depend on where the link was asked for). */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "email") as EmailOtpType;
  const nextParam = String(form.get("next") ?? "");
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  if (tokenHash && tokenHash.length < 200 && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, origin), 303);
  }
  return NextResponse.redirect(new URL("/login?error=link", origin), 303);
}
