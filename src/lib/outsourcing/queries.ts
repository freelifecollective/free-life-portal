import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorsById } from "@/lib/chats/queries";

export type Provider = {
  member_id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; is_admin: boolean;
  headline: string; about: string | null; tasks: string[]; hourly_rate_cents: number; hires: number; reviews: number; avg_rating: number | null;
};
export type Review = { id: string; provider_id: string; reviewer: string; rating: number; review: string | null; at: string };
export type MyHire = { id: string; provider_id: string; rating: number | null; review: string | null };
export type MyListing = { headline: string; about: string | null; tasks: string[]; hourly_rate_cents: number; listed: boolean };

export async function loadOutsourcing(supabase: SupabaseClient, me: string) {
  const [{ data: dir }, { data: mine }, { data: hired }] = await Promise.all([
    supabase.rpc("outsourcing_directory"),
    supabase.from("outsourcing_profiles").select("headline, about, tasks, hourly_rate_cents, listed").eq("member_id", me).maybeSingle(),
    supabase.from("outsourcing_hires").select("id, provider_id, rating, review").eq("hirer_id", me),
  ]);
  const providers = (dir ?? []) as Provider[];
  const ids = providers.map((p) => p.member_id);
  const { data: rv } = ids.length
    ? await supabase.from("outsourcing_hires").select("id, provider_id, hirer_id, rating, review, reviewed_at").in("provider_id", ids).not("rating", "is", null).order("reviewed_at", { ascending: false })
    : { data: [] };
  const authors = await authorsById(supabase, (rv ?? []).map((r) => r.hirer_id));
  const reviews: Review[] = (rv ?? []).map((r) => ({ id: r.id, provider_id: r.provider_id, reviewer: authors.get(r.hirer_id)?.name ?? "A member", rating: r.rating, review: r.review, at: r.reviewed_at }));
  return { providers, mine: (mine as MyListing | null) ?? null, hired: (hired ?? []) as MyHire[], reviews };
}
