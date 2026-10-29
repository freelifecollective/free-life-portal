"use client";

import { useEffect, useState } from "react";

const CHANNEL = "flc-login";

/**
 * Signed in. If the login page is still open in another tab, that tab takes over (it moves into the portal) and this
 * one steps aside. Otherwise (a different browser or phone) this tab simply goes on into the portal.
 */
export function Handoff({ next }: { next: string }) {
  const [handedOver, setHandedOver] = useState(false);
  useEffect(() => {
    let done = false;
    const go = () => { if (!done) { done = true; window.location.replace(next); } };
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (e) => {
        if (e.data === "ack" && !done) {
          done = true;
          setHandedOver(true);
          window.close(); // only allowed in some browsers; if not, the message below tells them
        }
      };
      ch.postMessage("signed-in");
    } catch { /* no channel: just carry on */ }
    const t = window.setTimeout(go, 900);
    return () => { window.clearTimeout(t); ch?.close(); };
  }, [next]);
  return handedOver ? (
    <>
      <p className="splash-tag">You&rsquo;re in!</p>
      <p className="login-note">Your portal is open in your other tab. You can close this one.</p>
      <a className="btn primary" href={next} style={{ textDecoration: "none", marginTop: 14 }}>Open the portal here instead</a>
    </>
  ) : (
    <>
      <p className="splash-tag">Opening your portal</p>
      <span className="splash-bar" aria-hidden="true" />
    </>
  );
}
