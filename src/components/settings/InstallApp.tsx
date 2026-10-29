"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type W = Window & { __flcInstall?: InstallEvent | null };
const FLAG = "flc_app_installed";

function subscribe(cb: () => void) {
  window.addEventListener("flc:installready", cb);
  window.addEventListener("flc:installed", cb);
  window.addEventListener("flc:installed-declined", cb);
  return () => { window.removeEventListener("flc:installready", cb); window.removeEventListener("flc:installed", cb); window.removeEventListener("flc:installed-declined", cb); };
}
const flag = () => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; /* storage may be blocked */ } };

/** "Get the app" for Settings: a real Install button where the browser allows it, a clear "installed" tick once it is, and picture steps on iPhone. */
export function InstallApp() {
  const [gone, setGone] = useState(false);
  const [related, setRelated] = useState(false);
  const env = useSyncExternalStore(subscribe, () => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const offer = (window as W).__flcInstall ? "offer" : "none";
    return `${ios ? "ios" : "other"}-${standalone ? "standalone" : "browser"}-${offer}-${flag() ? "flag" : "noflag"}`;
  }, () => "ssr");

  /* Chrome can tell us the app is installed even when this page is open in a normal tab */
  useEffect(() => {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    nav.getInstalledRelatedApps?.().then((apps) => { if (apps.length) { try { localStorage.setItem(FLAG, "1"); } catch { /* ignore */ } setRelated(true); } }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      if (env.includes("-standalone-")) localStorage.setItem(FLAG, "1");
      else if (env.includes("-offer-")) localStorage.removeItem(FLAG); /* the browser is offering to install, so it is not installed (any more) */
    } catch { /* ignore */ }
  }, [env]);

  if (env === "ssr") return null;
  const [os, mode, offer, saved] = env.split("-");
  const installed = !gone && (mode === "standalone" || related || (saved === "flag" && offer !== "offer"));
  if (gone || installed) return <p style={{ margin: 0 }}>The app is installed on this device. ✓</p>;

  if (offer === "offer") {
    return (
      <button className="btn primary" type="button" onClick={async () => {
        const evt = (window as W).__flcInstall;
        if (!evt) return;
        await evt.prompt();
        const choice = await evt.userChoice;
        (window as W).__flcInstall = null;
        if (choice.outcome === "accepted") { try { localStorage.setItem(FLAG, "1"); } catch { /* ignore */ } setGone(true); } else window.dispatchEvent(new Event("flc:installed-declined"));
      }}>Install the app</button>
    );
  }
  if (os === "ios") {
    return <p style={{ margin: 0 }}>Already added it? Open the <strong>FLC</strong> icon on your home screen and this page will show a tick. To install on iPhone or iPad: open this page in <strong>Safari</strong>, tap the <strong>three dots</strong> at the bottom of the screen, tap <strong>Share</strong>, then tap <strong>View More</strong> and <strong>Add to Home Screen</strong>. A picture guide is below.</p>;
  }
  return <p style={{ margin: 0 }}>The browser is not offering an install button right now. If you already installed the app, open it once from your computer or phone (look for <strong>Free Life Collective</strong> or <strong>FLC</strong>) and this page will show a tick from then on. If you have not, open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</p>;
}
