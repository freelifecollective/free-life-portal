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
  if (role !== "lead" && role !== "member" && role !== "downline") return { error: "Choose lead, member or downline.", done: "" };
  const { data: blocked } = await supabase.from("blocked_emails").select("email").eq("email", email).maybeSingle();
  if (blocked) return { error: "That email has been blocked from the portal, so it cannot be invited.", done: "" };
  await supabase.rpc("admin_restore_person", { p_email: email, p_role: role });
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
  if (role !== "downline" && role !== "lead" && role !== "member" && role !== "admin") return;
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/people");
}

export type RemoveResult = { error: string } | { ok: true };

/** Take someone out of the portal: they lose access to everything and need a new invite to come back. "block" also stops that email ever having an account. */
export async function removePerson(id: string, mode: "remove" | "block", reason: string, note: string, typed: string): Promise<RemoveResult> {
  const { session, supabase } = await requireAdmin();
  if (!UUID.test(id) || id === session.user.id) return { error: "That person cannot be removed." };
  if (mode !== "remove" && mode !== "block") return { error: "Something went wrong." };
  if (typed.trim().toLowerCase() !== mode) return { error: `Type the word ${mode} to confirm.` };
  const why = note.trim().slice(0, 500);
  if (mode === "remove") {
    if (reason !== "cancelled" && reason !== "unpaid" && reason !== "manual") return { error: "Choose why they are being removed." };
    if (reason === "manual" && !why) return { error: "Please say why you are removing them, so it is noted for the future." };
  }
  const { error } = await supabase.rpc("admin_remove_person", { p_id: id, p_reason: mode === "block" ? "manual" : reason, p_note: why || null, p_block: mode === "block" });
  if (error) return { error: error.message.includes("change them to a member") ? "Change them from admin to member first." : "We could not remove them. Please try again." };
  revalidatePath("/admin/people");
  return { ok: true };
}

/** Puts a paying member on one of the plans (47, 97 or 297), or takes them off (empty). Admins only. */
export async function setPlan(id: string, plan: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) return { ok: false };
  const n = plan === "" ? null : Number(plan);
  if (n !== null && n !== 47 && n !== 97 && n !== 297) return { ok: false };
  const { error } = await supabase.from("profiles").update({ plan: n }).eq("id", id);
  revalidatePath("/admin/people"); revalidatePath("/plans");
  return { ok: !error };
}
