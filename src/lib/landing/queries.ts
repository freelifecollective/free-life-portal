import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicCall, PublicLanding } from "./types";

export async function getPublicLanding(supabase: SupabaseClient, username: string): Promise<PublicLanding | null> {
  if (!/^[a-z0-9_-]{3,30}$/i.test(username)) return null;
  const { data } = await supabase.rpc("public_landing", { p_username: username });
  return (data as PublicLanding | null) ?? null;
}

export async function getNextPublicCall(supabase: SupabaseClient): Promise<PublicCall | null> {
  const { data } = await supabase.rpc("next_public_call");
  return (data as PublicCall | null) ?? null;
}
