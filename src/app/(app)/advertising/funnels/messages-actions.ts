"use server";

import { revalidatePath } from "next/cache";
import { requirePlan } from "@/lib/auth/guards";
import { DEFAULT_MESSAGES } from "@/lib/messages/defaults";

export type Result = { ok: boolean; error?: string; id?: string };
const UUID = /^[0-9a-f-]{36}$/i;

/** Save an email or a text (new when there is no id). */
export async function saveMessage(input: { id?: string; kind: "email" | "text"; name: string; subject?: string; body: string }): Promise<Result> {
  const { session, supabase } = await requirePlan(97);
  const kind = input.kind === "text" ? "text" : "email";
  const name = input.name.trim().slice(0, 80), body = input.body.trim();
  const subject = kind === "email" ? (input.subject ?? "").trim().slice(0, 200) : null;
  if (!name) return { ok: false, error: "Give it a name so you can find it later." };
  if (!body) return { ok: false, error: "Write the message first." };
  if (kind === "email" && !subject) return { ok: false, error: "An email needs a subject line." };
  if (kind === "text" && body.length > 640) return { ok: false, error: "Texts can be up to 640 characters (about 4 texts long)." };
  if (body.length > 10000) return { ok: false, error: "That email is too long." };
  const row = { owner_id: session.user.id, kind, name, subject, body, updated_at: new Date().toISOString() };
  const { data, error } = input.id && UUID.test(input.id)
    ? await supabase.from("member_messages").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("member_messages").insert(row).select("id").single();
  revalidatePath("/advertising/funnels/emails"); revalidatePath("/advertising/funnels/automations");
  return error || !data ? { ok: false, error: "We could not save it. Please try again." } : { ok: true, id: data.id };
}

/** Start from one of the ready-made messages: it becomes the member's own copy to change. */
export async function copyDefaultMessage(key: string): Promise<Result> {
  const { session, supabase } = await requirePlan(97);
  const d = DEFAULT_MESSAGES.find((m) => m.key === key);
  if (!d) return { ok: false };
  const { data, error } = await supabase.from("member_messages").insert({ owner_id: session.user.id, kind: d.kind, name: d.name, subject: d.subject ?? null, body: d.body, default_key: d.key }).select("id").single();
  revalidatePath("/advertising/funnels/emails"); revalidatePath("/advertising/funnels/automations");
  return error || !data ? { ok: false, error: "We could not add it." } : { ok: true, id: data.id };
}

export async function deleteMessage(id: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(id)) return { ok: false };
  const { error } = await supabase.from("member_messages").delete().eq("id", id);
  revalidatePath("/advertising/funnels/emails"); revalidatePath("/advertising/funnels/automations");
  return { ok: !error };
}

export type StepInput = { wait_hours: number; message_id: string };

/** Save an automation: what starts it (a funnel's form, or any) and its steps in order. */
export async function saveAutomation(input: { id?: string; name: string; funnel_id: string | null; active: boolean; steps: StepInput[] }): Promise<Result> {
  const { session, supabase } = await requirePlan(97);
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Give your automation a name." };
  if (input.funnel_id !== null && !UUID.test(input.funnel_id)) return { ok: false };
  const steps = input.steps.slice(0, 30).map((s) => ({ wait_hours: Math.max(0, Math.min(8760, Math.round(Number(s.wait_hours) || 0))), message_id: s.message_id })).filter((s) => UUID.test(s.message_id));
  if (!steps.length) return { ok: false, error: "Add at least one email or text to send." };
  const row = { owner_id: session.user.id, name, funnel_id: input.funnel_id, active: !!input.active, steps, updated_at: new Date().toISOString() };
  const { data, error } = input.id && UUID.test(input.id)
    ? await supabase.from("automations").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("automations").insert(row).select("id").single();
  revalidatePath("/advertising/funnels/automations");
  return error || !data ? { ok: false, error: "We could not save it. Please try again." } : { ok: true, id: data.id };
}

export async function deleteAutomation(id: string): Promise<Result> {
  const { supabase } = await requirePlan(97);
  if (!UUID.test(id)) return { ok: false };
  const { error } = await supabase.from("automations").delete().eq("id", id);
  revalidatePath("/advertising/funnels/automations");
  return { ok: !error };
}
