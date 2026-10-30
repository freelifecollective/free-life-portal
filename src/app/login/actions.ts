"use server";

import { headers } from "next/headers";
import { redirect as goTo } from "next/navigation";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message: string; email?: string; next?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Sends a one-time sign-in link. Same reply whether or not the address is known. */
export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = String(form.get("next") ?? "");
  if (!EMAIL.test(email)) return { status: "error", message: "Enter a valid email address." };
  if (!supabaseConfigured) return { status: "error", message: "Sign-in is not configured yet." };

  const redirect = new URL("/auth/callback", await siteOrigin());
  if (next.startsWith("/") && !next.startsWith("//")) redirect.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString() } });
  // An email that has not been invited is refused by the database. Say the same thing as for a real one,
  // so nobody can use this form to find out who is a member.
  const notInvited = error && (error.code === "unexpected_failure" || /database error/i.test(error.message));
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit" || /rate limit/i.test(error.message))) {
    return { status: "error", message: "Too many sign-in emails have been requested. Please wait about an hour and try again." };
  }
  if (error && !notInvited) return { status: "error", message: "We could not send that link. Please try again in a minute." };
  return { status: "sent", message: "If that email is on our list, a sign-in email is on its way.", email, next };
}

export type CodeState = { error: string };

/** Signs in with the 6-digit code from the email. This is how the installed app gets in, because a link in an email opens the browser instead. */
export async function verifyCode(email: string, next: string, _prev: CodeState, form: FormData): Promise<CodeState> {
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!EMAIL.test(email)) return { error: "Please start again and request a new email." };
  if (token.length !== 6) return { error: "Enter the 6-digit code from the email." };
  if (!supabaseConfigured) return { error: "Sign-in is not configured yet." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    if (error.status === 429) return { error: "Too many tries. Please wait a few minutes and try again." };
    return { error: "That code did not work. Check it, or request a new email." };
  }
  goTo(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
