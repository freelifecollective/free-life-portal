"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/guards";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

export type InviteState = { error: string; done: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Emails a login link straight away, so an invite does not depend on the person finding the login page themselves. */
async function sendLoginEmail(email: string): Promise<boolean> {
  try {
    const h = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
    /* a plain client with no cookies: the link in the email must not be tied to the admin's browser */
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
    return !error;
  } catch { return false; }
}

/** Let someone create an account: they can sign in with this email from now on. */
export async function inviteEmail(_prev: InviteState, form: FormData): Promise<InviteState> {
  const { session, supabase } = await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  if (!EMAIL.test(email) || email.length > 254) return { error: "Enter a valid email address.", done: "" };
  if (role !== "lead" && role !== "member") return { error: "Choose lead or member.", done: "" };
  const { error } = await supabase.from("signup_allowlist").insert({ email, role, note: note || null, created_by: session.user.id });
  if (error) return { error: error.code === "23505" ? "That email is already on the list." : "We could not add that email. Please try again.", done: "" };
  revalidatePath("/admin/people");
  const sent = await sendLoginEmail(email);
  return { error: "", done: sent ? `${email} can now sign in as a ${role}. We emailed them their login link.` : `${email} can now sign in as a ${role}, but we could not email them the link. Ask them to open the portal and enter this email on the login page.` };
}

/** Take back an invite that has not been used yet. */
export async function removeInvite(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  await supabase.from("signup_allowlist").delete().eq("email", email).is("claimed_at", null);
  revalidatePath("/admin/people");
}

/** Change what someone can see. You cannot change your own role, so an admin can never lock themselves out. */
export async function setRole(form: FormData): Promise<void> {
  const { session, supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const role = String(form.get("role") ?? "");
  if (!UUID.test(id) || id === session.user.id) return;
  if (role !== "lead" && role !== "member" && role !== "admin") return;
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/people");
}

/** Membership standing, until payments can set it automatically: the date someone stopped paying, and whether they were removed from the community. */
export async function setStanding(form: FormData): Promise<void> {
  const { session, supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const since = String(form.get("unpaid_since") ?? "").trim();
  const removed = form.get("removed") === "on";
  if (!UUID.test(id) || id === session.user.id) return;
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return;
  await supabase.from("profiles").update({ unpaid_since: since || null, removed_at: removed ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/admin/people");
}
