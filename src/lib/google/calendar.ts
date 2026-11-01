import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Busy } from "./busy";

const ID = process.env.GOOGLE_CLIENT_ID ?? "";
const SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
/** Only the times you are busy are read: never the names or details of your events. */
export const SCOPES = "openid email https://www.googleapis.com/auth/calendar.freebusy";

export const googleConfigured = Boolean(ID && SECRET);

export function authUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({ client_id: ID, redirect_uri: redirectUri, response_type: "code", scope: SCOPES, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenReply = { access_token?: string; refresh_token?: string; id_token?: string; error?: string };

async function token(body: Record<string, string>): Promise<TokenReply> {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: ID, client_secret: SECRET, ...body }), cache: "no-store" });
  return (await r.json().catch(() => ({}))) as TokenReply;
}

/** Trades the code Google sent back for a long-lived link, and finds out which Google account it is. */
export async function exchangeCode(code: string, redirectUri: string): Promise<{ refresh: string; email: string | null } | null> {
  const t = await token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) return null;
  let email: string | null = null;
  try { email = (JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString()) as { email?: string }).email ?? null; } catch { /* the email is only for display */ }
  return { refresh: t.refresh_token, email };
}

/**
 * When this member is busy between two moments, according to their linked Google Calendar (every event on their main calendar,
 * personal ones included). Returns null when nothing is linked or Google cannot be reached, so booking carries on as normal.
 */
export async function busyIntervals(memberId: string, fromIso: string, toIso: string): Promise<Busy[] | null> {
  if (!googleConfigured) return null;
  const db = createAdminClient();
  if (!db) return null;
  const { data } = await db.from("google_calendar_links").select("refresh_token").eq("member_id", memberId).maybeSingle();
  const refresh = (data as { refresh_token: string } | null)?.refresh_token;
  if (!refresh) return null;
  try {
    const t = await token({ refresh_token: refresh, grant_type: "refresh_token" });
    if (t.error === "invalid_grant") { await db.from("google_calendar_links").delete().eq("member_id", memberId); return null; }   /* they removed the access in Google */
    if (!t.access_token) return null;
    const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST", cache: "no-store",
      headers: { authorization: `Bearer ${t.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, timeZone: "UTC", items: [{ id: "primary" }] }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
    return (j.calendars?.primary?.busy ?? []).map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() })).filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));
  } catch { return null; }
}
