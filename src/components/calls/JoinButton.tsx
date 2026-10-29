"use client";

import { useState, useTransition } from "react";
import { joinCall } from "@/app/(app)/calls/actions";

/** Opens the live call. Pressing it also notes that you were there, which is what lets you leave feedback afterwards. */
export function JoinButton({ callId, label = "Join the call" }: { callId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span>
      <button type="button" className="btn primary" disabled={pending} onClick={() => start(async () => {
        setError("");
        const win = window.open("", "_blank"); // opened right away so the browser does not block it
        const r = await joinCall(callId);
        if (r.ok && r.url) { if (win) win.location.href = r.url; else window.location.href = r.url; }
        else { win?.close(); setError(r.error ?? "We could not open the call."); }
      })}>{pending ? "Opening…" : label}</button>
      {error ? <span className="err" role="alert" style={{ marginLeft: 10 }}>{error}</span> : null}
    </span>
  );
}
