"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { geocode, suggest } from "@/lib/water/geocode";
import type { Suggestion } from "@/lib/water/photon";
import type { Place } from "@/lib/water/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Finds a town, city or address on the map (used by the search box). */
export async function searchPlace(query: string): Promise<Result<{ place: Place }>> {
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const place = await geocode(String(query ?? ""));
  if (!place) return { ok: false, error: "We could not find that place. Try a town or city and its country." };
  return { ok: true, place };
}

/** Choices for the address box while typing, like Google Maps. */
export async function suggestPlaces(query: string): Promise<Suggestion[]> {
  const { supabase } = await requireMember();
  if (!supabase) return [];
  return suggest(String(query ?? ""));
}

/** Adds the signed-in affiliate to the map, or moves their dot. A blank address keeps the current spot when they are editing. */
export async function saveWaterShare(input: { address: string; chosen?: Place | null; prefilter: boolean | null; waterType: string }): Promise<Result> {
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  if (session.profile.role === "lead") return { ok: false, error: "The map is for affiliates." };
  if (typeof input.prefilter !== "boolean") return { ok: false, error: "Please say whether you have a prefilter." };
  if (input.waterType !== "city" && input.waterType !== "well") return { ok: false, error: "Please choose city water or well water." };
  const address = String(input.address ?? "").trim();
  const me = session.user.id;
  const { data: existing } = await supabase.from("water_share").select("member_id").eq("member_id", me).maybeSingle();
  const c = input.chosen;
  const chosen = c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 && typeof c.label === "string" && c.label.trim() ? { lat: c.lat, lng: c.lng, place: c.label.trim().slice(0, 160) } : null;
  if (!address && !chosen && !existing) return { ok: false, error: "Please type an address near you." };
  let where: { lat: number; lng: number; place: string } | null = null;
  if (chosen) where = chosen;
  else if (address) {
    const hit = await geocode(address);
    if (!hit) return { ok: false, error: "We could not find that address. Try a nearby gas station, grocery store or just the town and country." };
    where = { lat: hit.lat, lng: hit.lng, place: hit.label };
  }
  const { error } = existing
    ? await supabase.from("water_share").update({ ...(where ?? {}), prefilter: input.prefilter, water_type: input.waterType }).eq("member_id", me)
    : await supabase.from("water_share").insert({ member_id: me, ...where!, prefilter: input.prefilter, water_type: input.waterType });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  await supabase.from("water_share_asked").upsert({ member_id: me }, { onConflict: "member_id", ignoreDuplicates: true });
  revalidatePath("/water-map");
  return { ok: true };
}

/** "No I do not want to be added": remembered so the question is not asked again. */
export async function declineWaterShare(): Promise<Result> {
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("water_share_asked").upsert({ member_id: session.user.id }, { onConflict: "member_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  return { ok: true };
}

export async function removeWaterShare(): Promise<Result> {
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("water_share").delete().eq("member_id", session.user.id);
  if (error) return { ok: false, error: "We could not remove you. Please try again." };
  revalidatePath("/water-map");
  return { ok: true };
}
