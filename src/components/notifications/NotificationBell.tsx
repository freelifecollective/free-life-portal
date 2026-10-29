"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** The bell at the top right with the unread count. It also puts the same number on the app icon, and refreshes when something new arrives. */
export function NotificationBell({ count, userId }: { count: number; userId: string }) {
  const router = useRouter();

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

  return (
    <Link href="/notifications" className="bell" data-tour="bell" aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {count > 0 ? <span className="badge bell-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
