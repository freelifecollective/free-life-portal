import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FinancingOption = {
  id: string; title: string; description: string; link: string | null;
  status: "pending" | "approved" | "declined"; submitted_by: string | null; created_at: string; review_note: string | null;
};
const COLS = "id, title, description, link, status, submitted_by, created_at, review_note";

export async function listApproved(supabase: SupabaseClient): Promise<FinancingOption[]> {
  const { data } = await supabase.from("financing_options").select(COLS).eq("status", "approved").order("title");
  return (data ?? []) as FinancingOption[];
}

/** The signed-in person's own suggestions that are still waiting or were declined. */
export async function mySuggestions(supabase: SupabaseClient, me: string): Promise<FinancingOption[]> {
  const { data } = await supabase.from("financing_options").select(COLS).eq("submitted_by", me).neq("status", "approved").order("created_at", { ascending: false });
  return (data ?? []) as FinancingOption[];
}

export async function listAll(supabase: SupabaseClient): Promise<FinancingOption[]> {
  const { data } = await supabase.from("financing_options").select(COLS).order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as FinancingOption[];
}

export async function pendingFinancingCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("financing_options").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}
