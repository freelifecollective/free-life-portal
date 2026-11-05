import "server-only";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Emails a login link straight away, so an invite does not depend on the person finding the login page themselves. */
export async function sendLoginEmail(email: string): Promise<boolean> {
  try {
    const h = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    /* a plain client with no cookies: the link in the email must not be tied to the admin's browser */
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
    return !error;
  } catch { return false; }
}

