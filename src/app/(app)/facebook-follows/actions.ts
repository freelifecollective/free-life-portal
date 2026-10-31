"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { cleanHandle, handleState } from "@/lib/handles";
import { facebookUrl } from "@/lib/landing/types";

type Result = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lists my Facebook page. Accepts a handle or a pasted link. */
export async function addMyPage(input: string): Promise<Result> {
  const raw = String(input ?? "").trim();
  if (handleState(raw, "facebook") !== "ok") return { ok: false, error: "Please enter your Facebook page link, or its handle (for example facebook.com/yourpage)." };
  const url = facebookUrl(cleanHandle(raw, "facebook"));
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("fb_follow_add", { p_url: url });
  if (error) return { ok: false, error: error.code === "42501" ? "Only affiliates can list a page." : "We could not add your page. Please try again." };
  revalidatePath("/facebook-follows");
  return { ok: true };
}

/** Takes my page off the list (or, for an admin, someone else's). */
export async function removePage(target?: string): Promise<Result> {
  if (target && !UUID.test(target)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("fb_follow_remove", { p_target: target ?? null });
  if (error) return { ok: false, error: "We could not remove that page." };
  revalidatePath("/facebook-follows");
  return { ok: true };
}

/** "I followed them" (or take it back). */
export async function setFollow(target: string, on: boolean): Promise<Result> {
  if (!UUID.test(target)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("fb_follow_set", { p_target: target, p_on: on });
  if (error) return { ok: false, error: error.code === "P0002" ? "That page has just reached 50 follows. Thank you!" : "We could not save that. Please try again." };
  revalidatePath("/facebook-follows");
  return { ok: true };
}
