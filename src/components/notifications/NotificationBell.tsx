"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markAllRead, markRead } from "@/app/(app)/notifications/actions";
import { formatInZone } from "@/lib/time";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; kind: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null };
const ICON: Record<string, string> = { new_lead: "🌱", call_reminder: "📞", call_new: "🗓️", important_update: "📣", submission_result: "✅", announcement: "✨", direct_message: "💬", payment: "💳", task: "📝" };

/** The bell at the top right with the unread count. It also puts the same number on the app icon, and refreshes when something new arrives. */
export function NotificationBell({ count, userId }: { count: number; userId: string }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try { (count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.())?.catch(() => {}); } catch { /* not supported on this device */ }
  }, [count]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("my-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [router, userId]);

  /* the list is read each time the dropdown opens, and again when a new notification arrives while it is open */
  useEffect(() => {
    if (!open) return;
    let live = true;
    void createClient().from("notifications").select("id, kind, title, body, url, created_at, read_at").neq("kind", "chat_message").order("created_at", { ascending: false }).limit(15)
      .then(({ data }) => { if (live) setItems((data ?? []) as Item[]); });
    return () => { live = false; };
  }, [open, count]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function choose(n: Item) {
    setOpen(false);
    if (!n.read_at) await markRead(n.id);
    router.push(n.url ?? "/notifications");
  }

  return (
    <div className="notif-wrap" ref={box}>
    <button type="button" className="bell" data-tour="bell" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {count > 0 ? <span className="badge bell-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </button>
    {open ? (
      <div className="notif-panel" role="dialog" aria-label="Notifications">
        <div className="notif-panel-head">
          <strong>Notifications</strong>
          {count > 0 ? <button type="button" className="linkbtn" onClick={() => void markAllRead().then(() => { setItems((cur) => cur && cur.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() }))); router.refresh(); })}>Mark all as read</button> : null}
        </div>
        <ul className="notif-list">
          {(items ?? []).map((n) => (
            <li key={n.id} className={n.read_at ? "" : "unread"}>
              <button type="button" onClick={() => void choose(n)}>
                <span className="notif-icon" aria-hidden="true">{ICON[n.kind] ?? "🔔"}</span>
                <span className="notif-main"><strong>{n.title}</strong>{n.body ? <span>{n.body}</span> : null}<time className="when" dateTime={n.created_at}>{formatInZone(new Date(n.created_at))}</time></span>
                {!n.read_at ? <span className="notif-dot" aria-label="Unread" /> : null}
              </button>
            </li>
          ))}
          {items && items.length === 0 ? <li className="dock-empty">Nothing yet. When something happens, you will see it here.</li> : null}
          {!items ? <li className="dock-empty">Loading…</li> : null}
        </ul>
        <Link className="notif-all" href="/notifications" onClick={() => setOpen(false)}>See all notifications</Link>
      </div>
    ) : null}
    </div>
  );
}
