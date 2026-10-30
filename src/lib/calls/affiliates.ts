import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toZonedInput } from "@/lib/time";
import { addMonths } from "@/lib/dashboard/payments";
import { nowMs } from "@/lib/time";

export type Affiliate = { id: string; name: string; photo_url: string | null };

/** Paying affiliates (not removed, and not more than two months behind), A to Z, with their profile pictures, for choosing a speaker. */
export async function listAffiliates(supabase: SupabaseClient): Promise<Affiliate[]> {
  const { data } = await supabase.from("profiles").select("id, first_name, last_name, avatar_url, unpaid_since, removed_at")
    .in("role", ["member", "admin"]).not("onboarded_at", "is", null).is("removed_at", null).limit(1000);
  const cutoff = addMonths(toZonedInput(new Date(nowMs())).slice(0, 10), -2);
  return ((data ?? []) as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; unpaid_since: string | null }[])
    .filter((p) => !p.unpaid_since || p.unpaid_since > cutoff)
    .map((p) => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member", photo_url: p.avatar_url }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
