"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireMember } from "@/lib/auth/guards";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { isAffiliate } from "@/lib/roles";

export type LeadInviteState = { error: string; done: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Emails the new lead a sign-in link straight away (a plain client, so the link is not tied to the inviter's browser). */
async function sendLoginEmail(email: string): Promise<boolean> {
  try {
    const h = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
    return !error;
  } catch { return false; }
}

/** Any paying affiliate can invite a lead. The lead then belongs to them. */
export async function inviteLead(_prev: LeadInviteState, form: FormData): Promise<LeadInviteState> {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return { error: "Inviting is for affiliates.", done: "" };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  if (!EMAIL.test(email)) return { error: "That does not look like an email address.", done: "" };
  const { data, error } = await supabase.rpc("invite_lead", { p_email: email, p_note: note || null });
  if (error) return { error: error.code === "42501" ? "Inviting is open to paying affiliates." : error.code === "23514" ? "You have a lot of invites waiting. Wait for some to join first." : "We could not invite them. Please try again.", done: "" };
  if (data === "exists") return { error: "That email is already in the portal.", done: "" };
  const sent = await sendLoginEmail(email);
  revalidatePath("/leads");
  return { error: "", done: sent ? `Invited. We emailed ${email} a sign-in link.` : `Invited. ${email} can now sign in from the login page.` };
}
