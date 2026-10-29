"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { joinCall } from "@/app/(app)/calls/actions";
import { formatInZone } from "@/lib/time";

const OPENS_BEFORE_MS = 10 * 60_000;
function subscribe(cb: () => void) { const t = window.setInterval(cb, 10_000); return () => window.clearInterval(t); }

/**
 * Joins the live call. The waiting room opens 10 minutes before the start: before that the button looks switched off,
 * and pressing it explains when to come back. Pressing it once it is open also notes that you were there.
 */
export function JoinButton({ callId, startsAt, label = "Join the call" }: { callId: string; startsAt: string; label?: string }) {
  const start = new Date(startsAt).getTime();
  const open = useSyncExternalStore(subscribe, () => Date.now() >= start - OPENS_BEFORE_MS, () => false);
  const [pending, run] = useTransition();
  const [error, setError] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);

  function press() {
    if (!open) { dlg.current?.showModal(); return; }
    run(async () => {
      setError("");
      const win = window.open("", "_blank"); // opened right away so the browser does not block it
      const r = await joinCall(callId);
      if (r.ok && r.url) { if (win) win.location.href = r.url; else window.location.href = r.url; }
      else { win?.close(); setError(r.error ?? "We could not open the call."); }
    });
  }

  return (
    <span className="join-wrap">
      <button type="button" className={"btn primary join-btn" + (open ? "" : " is-locked")} aria-disabled={!open} disabled={pending} onClick={press}>{pending ? "Opening…" : label}</button>
      {error ? <span className="err" role="alert">{error}</span> : null}
      <dialog ref={dlg} className="rs-dialog" aria-labelledby="jw-title">
        <h2 id="jw-title" className="qh" style={{ marginTop: 0 }}>Not open yet</h2>
        <p>This call is scheduled for {formatInZone(new Date(startsAt))}, the waiting room will open 10 minutes before the call starts. Check back closer to the start of the call to join.</p>
        <div className="dlg-actions"><button className="btn primary" type="button" onClick={() => dlg.current?.close()}>OK</button></div>
      </dialog>
    </span>
  );
}
