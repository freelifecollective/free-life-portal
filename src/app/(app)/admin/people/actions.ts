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

export type MilestoneState = { error: string; done: string };

/** Records a coaching call or a sale for a member, so their badges can be handed out. */
export async function logMilestone(_prev: MilestoneState, form: FormData): Promise<MilestoneState> {
  const { session, supabase } = await requireAdmin();
  const member = String(form.get("member") ?? "");
  const kind = String(form.get("kind") ?? "");
  const day = String(form.get("day") ?? "");
  const count = Math.floor(Number(form.get("count") ?? 1));
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  if (!UUID.test(member)) return { error: "Choose a member.", done: "" };
  if (kind !== "coaching" && kind !== "sale") return { error: "Choose coaching call or sale.", done: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Choose the date.", done: "" };
  if (!Number.isInteger(count) || count < 1 || count > 20) return { error: "The number must be between 1 and 20.", done: "" };
  const rows = Array.from({ length: count }, () => ({ member_id: member, kind, happened_on: day, note: note || null, logged_by: session.user.id }));
  const { error } = await supabase.from("milestone_events").insert(rows);
  if (error) return { error: "We could not save that. Please try again.", done: "" };
  revalidatePath("/admin/people");
  return { error: "", done: `Logged ${count} ${kind === "sale" ? (count === 1 ? "sale" : "sales") : count === 1 ? "coaching call" : "coaching calls"}. Any new badge appears the next time they open Tasks or their profile.` };
}

export async function removeMilestone(form: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("milestone_events").delete().eq("id", id);
  revalidatePath("/admin/people");
}
