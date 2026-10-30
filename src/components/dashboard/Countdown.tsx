"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) { const t = window.setInterval(cb, 1000); return () => window.clearInterval(t); }
const pad = (n: number) => String(n).padStart(2, "0");

/** Days, hours and minutes until the call starts. Once it starts it says so. */
export function Countdown({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const left = useSyncExternalStore(subscribe, () => Math.max(0, Math.floor((start - Date.now()) / 1000)), () => -1);
  const over = useSyncExternalStore(subscribe, () => Date.now() >= end, () => false);
  if (over) return <p className="cd-note">This call has finished. The recording will be in the Calls tab.</p>;
  if (left === 0) return <p className="cd-note cd-live">We are live now!</p>;
  const parts = left < 0 ? [0, 0, 0] : [Math.floor(left / 86400), Math.floor((left % 86400) / 3600), Math.floor((left % 3600) / 60)];
  const names = ["Days", "Hours", "Min"];
  return (
    <div className="cd" role="timer" aria-label="Time until the call" style={{ visibility: left < 0 ? "hidden" : "visible" }}>
      {parts.map((n, i) => <div key={names[i]} className="cd-box"><span className="cd-n">{pad(n)}</span><span className="cd-l">{names[i]}</span></div>)}
    </div>
  );
}
