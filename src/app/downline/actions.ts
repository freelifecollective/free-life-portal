"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export type DownlineState = { status: "idle" | "sent" | "error"; message: string };

/** The public sign-up for Lacey's downline: asks for an account, then emails a sign-in link. */
export async function requestDownlineAccess(_prev: DownlineState, form: FormData): Promise<DownlineState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return { status: "error", message: "That does not look like an email address." };
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("downline_signup", { p_email: email });
  if (error) return { status: "error", message: "Something went wrong. Please try again." };
  if (data === "member") return { status: "error", message: "Already registered in the system, this is only for members in Lacey's downline who are not paying to be a part of the FLC Community" };
  if (data === "busy") return { status: "error", message: "A lot of people are signing up right now. Please try again in a little while." };
  if (data !== "ok") return { status: "error", message: "That does not look like an email address." };
  try {
    const h = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const { error: e } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
    if (e) return { status: "error", message: "We could not send your sign-in link. Please try again." };
  } catch { return { status: "error", message: "We could not send your sign-in link. Please try again." }; }
  return { status: "sent", message: email };
}
