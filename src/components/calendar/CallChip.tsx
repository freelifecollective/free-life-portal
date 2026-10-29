"use client";

import { useRef, type ReactNode } from "react";
import { LiveDot } from "@/components/LiveBadge";

/** One call inside a day of the month grid. Pressing it opens the full call (RSVP, who is coming, join). */
export function CallChip({ time, title, live, past, children }: { time: string; title: string; live: boolean; past: boolean; children: ReactNode }) {
  const dlg = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={"cal-chip" + (live ? " live" : "") + (past ? " past" : "")} onClick={() => dlg.current?.showModal()}>
        {live ? <LiveDot size={8} /> : null}
        <span className="cal-chip-time">{time}</span>
        <span className="cal-chip-title">{title}</span>
      </button>
      <dialog ref={dlg} className="rs-dialog cal-dialog" aria-label={title}>
        {children}
        <div className="dlg-actions"><button className="btn" type="button" onClick={() => dlg.current?.close()}>Close</button></div>
      </dialog>
    </>
  );
}
