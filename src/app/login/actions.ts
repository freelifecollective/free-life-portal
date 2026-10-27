"use server";

import { headers } from "next/headers";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message: string };

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
  if (error) return { status: "error", message: "We could not send that link. Please try again in a minute." };
  return { status: "sent", message: "Check your email for your sign-in link." };
}
