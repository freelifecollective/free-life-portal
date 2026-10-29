"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllRead, markRead } from "@/app/(app)/notifications/actions";
import { formatInZone } from "@/lib/time";

export type Item = { id: string; kind: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null };
const ICON: Record<string, string> = { new_lead: "🌱", call_reminder: "📞", call_new: "🗓️", important_update: "📣", submission_result: "✅", announcement: "✨", direct_message: "💬", payment: "💳" };

export function NotificationList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !i.read_at).length;
  if (items.length === 0) return <section className="card-s" style={{ maxWidth: 560 }}><p style={{ margin: 0 }}>Nothing yet. When something happens, you will see it here.</p></section>;
  return (
    <div className="settings" style={{ maxWidth: 720 }}>
      {unread > 0 ? <p style={{ margin: 0 }}><button className="btn small" type="button" disabled={pending} onClick={() => start(async () => { await markAllRead(); router.refresh(); })}>Mark all as read</button></p> : null}
      <ul className="notif-list">
        {items.map((n) => (
          <li key={n.id} className={n.read_at ? "" : "unread"}>
            <button type="button" onClick={() => start(async () => { if (!n.read_at) await markRead(n.id); router.push(n.url ?? "/notifications"); })}>
              <span className="notif-icon" aria-hidden="true">{ICON[n.kind] ?? "🔔"}</span>
              <span className="notif-main"><strong>{n.title}</strong>{n.body ? <span>{n.body}</span> : null}<time className="when" dateTime={n.created_at}>{formatInZone(new Date(n.created_at))}</time></span>
              {!n.read_at ? <span className="notif-dot" aria-label="Unread" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
