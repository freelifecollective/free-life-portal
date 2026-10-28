import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Submission = {
  id: string; submitter_id: string; title: string; description: string; links: string[];
  files: { path: string; name: string; size: number }[]; status: "pending" | "accepted" | "declined";
  created_at: string; review_note: string | null;
};
const COLS = "id, submitter_id, title, description, links, files, status, created_at, review_note";

/** The signed-in person's own submissions (row level security limits it to theirs). */
export async function mySubmissions(supabase: SupabaseClient): Promise<Pick<Submission, "id" | "title" | "status" | "created_at">[]> {
  const { data } = await supabase.from("resource_submissions").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as Pick<Submission, "id" | "title" | "status" | "created_at">[];
}

export async function listSubmissions(supabase: SupabaseClient): Promise<Submission[]> {
  const { data } = await supabase.from("resource_submissions").select(COLS).order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as Submission[];
}

export async function pendingSubmissionCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("resource_submissions").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}
