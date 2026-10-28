"use server";

import { createClient } from "@/lib/supabase/server";

export type RegisterState = { status: "idle" | "done" | "error"; message: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGES: Record<string, string> = {
  invalid_name: "Enter your name.",
  invalid_email: "Enter a valid email address.",
  consent_required: "Please tick the box so we can email you about the call.",
  call_unavailable: "This call is no longer open for registration.",
};

/** Public: no account needed. The database checks the call is open and stores the registration. */
export async function registerForCall(callId: string, _prev: RegisterState, form: FormData): Promise<RegisterState> {
  if (!UUID.test(callId)) return { status: "error", message: MESSAGES.call_unavailable };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_call", {
    p_call: callId,
    p_name: String(form.get("name") ?? ""),
    p_email: String(form.get("email") ?? ""),
    p_consent: form.get("consent") === "on",
  });
  if (error || !data) return { status: "error", message: "We could not register you. Please try again in a minute." };
  if (!data.ok) return { status: "error", message: MESSAGES[data.reason] ?? "We could not register you." };
  return { status: "done", message: "" };
}
