"use server";

import { createClient } from "@/lib/supabase/server";

/** Someone filled in a form on a funnel page. Quiet about failures: a visitor only needs to know whether it worked. */
export async function submitFunnelForm(funnelId: string, stepId: string, fields: Record<string, string>): Promise<{ ok: boolean }> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(funnelId) || !uuid.test(stepId)) return { ok: false };
  const clean: Record<string, string> = {};
  for (const k of ["first_name", "last_name", "email", "phone"]) {
    const v = typeof fields[k] === "string" ? fields[k].trim().slice(0, 200) : "";
    if (v) clean[k] = v;
  }
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return { ok: false };
  if (!Object.keys(clean).length) return { ok: false };
  try {
    const { data } = await (await createClient()).rpc("submit_funnel_form", { p_funnel: funnelId, p_step: stepId, p_fields: clean });
    return { ok: data === true };
  } catch {
    return { ok: false };
  }
}
