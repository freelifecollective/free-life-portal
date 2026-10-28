import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { status: "idle" | "done" | "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGES: Record<string, string> = {
  invalid_name: "Enter your first and last name.",
  invalid_email: "Enter a valid email address.",
  consent_required: "Please tick the box so we can email you about the call.",
  call_unavailable: "This call is no longer open for registration.",
};

/** Register someone for a call. The database checks everything again; this only turns its answer into words. */
export async function submitRegistration(args: { callId: string; form: FormData; referrer?: string }): Promise<RegisterState> {
  if (!UUID.test(args.callId)) return { status: "error", message: MESSAGES.call_unavailable };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_for_call", {
    p_call: args.callId,
    p_first: String(args.form.get("first") ?? ""),
    p_last: String(args.form.get("last") ?? ""),
    p_email: String(args.form.get("email") ?? ""),
    p_consent: args.form.get("consent") === "on",
    p_referrer: args.referrer ?? null,
  });
  if (error || !data) return { status: "error", message: "We could not register you. Please try again in a minute." };
  if (!data.ok) return { status: "error", message: MESSAGES[data.reason as string] ?? "We could not register you." };
  return { status: "done", message: "" };
}
