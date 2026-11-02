"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function postWish(person: string, year: number, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(person) || !Number.isInteger(year)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("post_birthday_wish", { p_person: person, p_year: year, p_body: body });
  if (error) return { ok: false, error: error.code === "42501" ? "Birthday wishes are open to paying affiliates, on the day." : error.code === "22023" ? "Write between 1 and 500 characters." : "We could not post that. Please try again." };
  revalidatePath(`/birthday/${person}`);
  return { ok: true };
}

export async function removeWish(id: string, person: string): Promise<{ ok: boolean }> {
  if (!UUID.test(id) || !UUID.test(person)) return { ok: false };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("delete_birthday_wish", { p_id: id });
  revalidatePath(`/birthday/${person}`);
  return { ok: !error };
}
