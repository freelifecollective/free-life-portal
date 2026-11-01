import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { translateFor } from "@/i18n/server";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:freelifeplatform11@gmail.com";

export const pushConfigured = Boolean(PUBLIC && PRIVATE);

type Row = { id: string; user_id: string; kind: string; title: string; body: string | null; url: string | null };

/** Sends the phone/desktop push for notifications that were just stored. Returns how many pushes went out. */
export async function sendPushForNotifications(ids: string[]): Promise<number> {
  const db = createAdminClient();
  if (!db || !pushConfigured || ids.length === 0) return 0;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

  const { data: rows } = await db.from("notifications").select("id, user_id, kind, title, body, url").in("id", ids).is("pushed_at", null);
  const list = (rows ?? []) as Row[];
  if (list.length === 0) return 0;
  const users = [...new Set(list.map((r) => r.user_id))];
  const [{ data: subs }, { data: unread }, { data: langs }] = await Promise.all([
    db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users),
    db.from("notifications").select("user_id").in("user_id", users).is("read_at", null),
    db.from("profiles").select("id, lang").in("id", users),
  ]);
  const langOf = new Map((langs ?? []).map((p: { id: string; lang: string | null }) => [p.id, p.lang]));
  const counts = new Map<string, number>();
  for (const u of unread ?? []) counts.set(u.user_id, (counts.get(u.user_id) ?? 0) + 1);

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(list.flatMap((n) => (subs ?? []).filter((s) => s.user_id === n.user_id).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: translateFor(langOf.get(n.user_id), n.title) ?? n.title, body: translateFor(langOf.get(n.user_id), n.body) ?? "", url: n.url ?? "/notifications", badge: counts.get(n.user_id) ?? 1, tag: n.id }),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(s.id);
    }
  })));
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
  await db.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", list.map((n) => n.id));
  /* chat messages are only stored to be pushed: once sent they are not kept */
  const chatIds = list.filter((n) => n.kind === "chat_message").map((n) => n.id);
  if (chatIds.length) await db.from("notifications").delete().in("id", chatIds);
  return sent;
}
