"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";

export type InviteState = { error: string; done: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return { error: "", done: `${email} can now sign in as a ${role}.` };
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
