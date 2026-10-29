"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const none = () => () => {};

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Turn phone/desktop notifications on or off for this device. */
export function PushToggle({ userId }: { userId: string }) {
  const support = useSyncExternalStore(
    none,
    () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      return Notification.permission; // default | granted | denied
    },
    () => "ssr",
  );
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (support === "ssr" || support === "unsupported" || !KEY) return;
    let alive = true;
    navigator.serviceWorker.register("/sw.js").then((r) => r.pushManager.getSubscription()).then((s) => { if (alive) setOn(Boolean(s)); }).catch(() => { if (alive) setOn(false); });
    return () => { alive = false; };
  }, [support]);

  if (support === "ssr") return null;
  if (!KEY) return <p style={{ margin: 0 }}>Notifications are not switched on for the portal yet.</p>;
  if (support === "unsupported") return <p style={{ margin: 0 }}>This browser cannot receive notifications. On an iPhone, add the app to your Home Screen first, then open it from there.</p>;
  if (support === "denied") return <p style={{ margin: 0 }}>Notifications are blocked for this site. Allow them in your phone or browser settings, then come back.</p>;

  async function enable() {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setMsg("Notifications were not allowed."); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(KEY) }));
      const j = sub.toJSON();
      const supabase = createClient();
      const { error } = await supabase.from("push_subscriptions").upsert(
        { user_id: userId, endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "", user_agent: navigator.userAgent.slice(0, 200) },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      setOn(true); setMsg("Notifications are on for this device.");
    } catch { setMsg("We could not turn notifications on. Please try again."); } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
      setOn(false); setMsg("Notifications are off for this device.");
    } catch { setMsg("We could not turn them off. Please try again."); } finally { setBusy(false); }
  }

  return (
    <div>
      {on ? <button className="btn" type="button" disabled={busy} onClick={disable}>Turn off notifications</button>
          : <button className="btn primary" type="button" disabled={busy || on === null} onClick={enable}>Turn on notifications</button>}
      <p role="status" className="when" style={{ margin: "8px 0 0" }}>{msg}</p>
    </div>
  );
}
