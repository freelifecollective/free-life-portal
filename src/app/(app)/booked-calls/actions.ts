"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { getTz } from "@/lib/tasks/queries";
import { zonedToUtc } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result = { ok: true } | { ok: false; error: string };

/** Adds a call with a lead. `when` is the date and time as the person sees it ("2026-11-04T17:30"), in their own time zone. */
export async function addBookedCall(input: { lead: string; when: string; closer: string; note?: string }): Promise<Result> {
  const lead = String(input.lead ?? "").trim();
  if (!lead || lead.length > 80) return { ok: false, error: "Enter the lead's name." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Calls booked are for affiliates." };
  const at = zonedToUtc(String(input.when ?? ""), await getTz(supabase));
  if (!at) return { ok: false, error: "Choose the date and time of the call." };
  const closer = UUID.test(input.closer ?? "") ? input.closer : null;
  const { error } = await supabase.from("booked_calls").insert({ member_id: session.user.id, lead_name: lead, starts_at: at.toISOString(), closer_id: closer, note: String(input.note ?? "").trim().slice(0, 200) || null });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath("/");
  return { ok: true };
}

export async function removeBookedCall(id: string): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("booked_calls").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not remove that." };
  revalidatePath("/");
  return { ok: true };
}
