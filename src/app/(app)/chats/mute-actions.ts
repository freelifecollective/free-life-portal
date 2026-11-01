"use server";

import { requireMember } from "@/lib/auth/guards";

export type MuteMode = "1h" | "8h" | "3d" | "forever" | "off" | { until: string };
const HOURS = { "1h": 1, "8h": 8, "3d": 72 } as const;

/** Mutes or unmutes one chat or group for the signed-in person. */
export async function setMute(kind: "chat" | "group", target: string, mode: MuteMode): Promise<{ ok: boolean }> {
  const { supabase } = await requireMember();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(target)) return { ok: false };
  let until: string | null = null;
  if (typeof mode === "object") {
    const t = new Date(mode.until).getTime();
    if (!Number.isFinite(t) || t <= Date.now()) return { ok: false };
    until = new Date(t).toISOString();
  } else if (mode in HOURS) {
    until = new Date(Date.now() + HOURS[mode as keyof typeof HOURS] * 3600_000).toISOString();
  }
  const { error } = await supabase.rpc("set_chat_mute", { p_kind: kind, p_target: target, p_until: until, p_unmute: mode === "off" });
  return { ok: !error };
}
