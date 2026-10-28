"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setRsvp } from "@/app/(app)/calendar/actions";
import type { RsvpMode } from "@/lib/calls/types";

/** "I'll be there live" or "I'll watch the recording". Press the same button again to take it back. */
export function RsvpControls({ callId, mine }: { callId: string; mine: RsvpMode | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [shown, setShown] = useOptimistic<RsvpMode | null, RsvpMode | null>(mine, (_old, next) => next);

  function choose(mode: RsvpMode) {
    const next = shown === mode ? null : mode;
    setError("");
    start(async () => {
      setShown(next);
      const r = await setRsvp(callId, next);
      if (!r.ok) setError(r.error ?? "We could not save that.");
    });
  }

  return (
    <div>
      <div className="rsvp" role="group" aria-label="Your RSVP">
        <button type="button" className={"btn" + (shown === "live" ? " primary" : "")} aria-pressed={shown === "live"} disabled={pending} onClick={() => choose("live")}>
          {shown === "live" ? "You're coming live" : "I'll be there live"}
        </button>
        <button type="button" className={"btn" + (shown === "recording" ? " primary" : "")} aria-pressed={shown === "recording"} disabled={pending} onClick={() => choose("recording")}>
          {shown === "recording" ? "You'll watch the recording" : "I'll watch the recording"}
        </button>
      </div>
      <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
    </div>
  );
}
