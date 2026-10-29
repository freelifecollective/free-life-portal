"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) { const t = window.setInterval(cb, 60_000); return () => window.clearInterval(t); }
const today = () => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();

/** Today's date in the person's own time zone, with a line on each side, in the top bar. */
export function TopDate() {
  const text = useSyncExternalStore(subscribe, today, () => "");
  return <p className="top-date" aria-label={text ? `Today is ${text.toLowerCase()}` : undefined}><span style={{ visibility: text ? "visible" : "hidden" }}>{text || "THURSDAY, SEPTEMBER 30"}</span></p>;
}
