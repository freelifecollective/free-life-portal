"use client";

import { useRef } from "react";
import { buildIcs } from "@/lib/calls/ics";
import type { Call } from "@/lib/calls/types";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Adds this one call to the person's own calendar: a Google Calendar link, or a file that Apple Calendar and Outlook open. */
export function AddToCalendar({ call }: { call: Pick<Call, "id" | "title" | "description" | "host" | "starts_at" | "duration_minutes" | "kind" | "audience" | "pinned" | "join_url"> }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const end = new Date(new Date(call.starts_at).getTime() + call.duration_minutes * 60_000).toISOString();
  const link = () => `${window.location.origin}/calls`;
  const google = () => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(call.title)}&dates=${stamp(call.starts_at)}/${stamp(end)}&details=${encodeURIComponent((call.description ? call.description + "\n\n" : "") + "Join from the portal: " + link())}`;

  function download() {
    const ics = buildIcs([call as Call], link());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "free-life-call.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    dlg.current?.close();
  }

  return (
    <>
      <button type="button" className="dc-btn ghost" onClick={() => dlg.current?.showModal()}>Add to calendar</button>
      <dialog ref={dlg} className="rs-dialog" aria-labelledby="atc-title" style={{ width: "min(420px, calc(100vw - 32px))" }}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.current?.close(); }}>
        <h2 id="atc-title" className="qh" style={{ marginTop: 0 }}>Add this call to your calendar</h2>
        <div className="ws-actions">
          <button type="button" className="btn primary" onClick={() => { window.open(google(), "_blank", "noopener"); dlg.current?.close(); }}>Google Calendar</button>
          <button type="button" className="btn" onClick={download}>Apple Calendar or Outlook</button>
          <button type="button" className="linkbtn" onClick={() => dlg.current?.close()}>Cancel</button>
        </div>
        <p className="when" style={{ margin: "14px 0 0" }}>Want every call added automatically? Use the link at the bottom of the Calendar tab.</p>
      </dialog>
    </>
  );
}
