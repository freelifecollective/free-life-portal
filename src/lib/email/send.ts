import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail } from "./templates";
import { unsubscribeToken } from "./token";

export type DrainResult = { configured: boolean; sent: number; failed: number; skipped: number };
type Row = { id: string; to_email: string; template: string; payload: Record<string, unknown>; series: string | null; attempts: number };

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || "https://free-life-portal.vercel.app";

/** Sends the emails that are due. Safe to run as often as you like. Does nothing until the email service is connected (RESEND_API_KEY and EMAIL_FROM). */
export async function drainOutbox(limit = 40): Promise<DrainResult> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  const db = createAdminClient();
  const out: DrainResult = { configured: !!(key && from && db), sent: 0, failed: 0, skipped: 0 };
  if (!key || !from || !db) return out;
  const { data } = await db.from("email_outbox").select("id, to_email, template, payload, series, attempts").eq("status", "pending").lte("send_after", new Date().toISOString()).order("send_after").limit(limit);
  for (const r of (data ?? []) as Row[]) {
    const unsub = r.series ? (await db.from("email_unsubscribes").select("email").eq("email", r.to_email).maybeSingle()).data : null;
    if (unsub) { await db.from("email_outbox").update({ status: "skipped", error: "unsubscribed" }).eq("id", r.id); out.skipped++; continue; }
    const link = r.series ? `${siteUrl()}/unsubscribe?e=${encodeURIComponent(r.to_email)}&t=${unsubscribeToken(r.to_email)}` : null;
    const mail = renderEmail(r.template, r.payload ?? {}, { siteUrl: siteUrl(), unsubscribeUrl: link });
    if (!mail) { await db.from("email_outbox").update({ status: "failed", error: "unknown template" }).eq("id", r.id); out.failed++; continue; }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [r.to_email], subject: mail.subject, html: mail.html, text: mail.text, ...(link ? { headers: { "List-Unsubscribe": `<${link}>` } } : {}) }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      await db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: r.attempts + 1, error: null }).eq("id", r.id);
      out.sent++;
    } catch (e) {
      const attempts = r.attempts + 1;
      await db.from("email_outbox").update({ status: attempts >= 5 ? "failed" : "pending", attempts, error: String(e).slice(0, 300) }).eq("id", r.id);
      out.failed++;
    }
  }
  return out;
}
