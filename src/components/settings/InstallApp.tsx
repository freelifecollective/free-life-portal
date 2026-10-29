"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const none = () => () => {};

/** "Install the app" for Settings. Android and desktop Chrome offer a real install button; iPhone needs two taps in Safari, so we show them. */
export function InstallApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  const env = useSyncExternalStore(none, () => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return `${ios ? "ios" : "other"}-${standalone ? "installed" : "browser"}`;
  }, () => "ssr");

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (env === "ssr") return null;
  if (done || env.endsWith("installed")) return <p style={{ margin: 0 }}>The app is installed on this device. ✓</p>;
  if (evt) {
    return <button className="btn primary" type="button" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === "accepted") setDone(true); setEvt(null); }}>Install the app</button>;
  }
  if (env.startsWith("ios")) {
    return <p style={{ margin: 0 }}>To install on iPhone or iPad: open this page in <strong>Safari</strong>, tap the <strong>three dots</strong> at the bottom of the screen, tap <strong>Share</strong>, then tap <strong>View More</strong> and <strong>Add to Home Screen</strong>. A picture guide is below.</p>;
  }
  return <p style={{ margin: 0 }}>To install: open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</p>;
}
