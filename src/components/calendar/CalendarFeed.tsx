"use client";

import { useRef, useState, useTransition } from "react";
import { calendarToken } from "@/app/(app)/calendar/actions";

/** Lets someone subscribe their own Google / Apple calendar so every call (with reminders) appears there by itself. */
export function CalendarFeed({ token: first }: { token: string }) {
  const [token, setToken] = useState(first);
  const [copied, setCopied] = useState(false);
  const [pending, run] = useTransition();
  const dlg = useRef<HTMLDialogElement>(null);
  const host = typeof window === "undefined" ? "" : window.location.host;
  const webcal = `webcal://${host}/api/calendar/${token}`;
  const https = `https://${host}/api/calendar/${token}`;
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(https); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { /* the link is shown below to copy by hand */ }
  }
  function reset() {
    run(async () => { const t = await calendarToken(true); if (t) setToken(t); dlg.current?.close(); });
  }

  return (
    <section className="card-s cal-feed" aria-label="Add calls to your calendar">
      <h2 className="qh" style={{ margin: "0 0 4px" }}>Put the calls in your own calendar</h2>
      <p className="when" style={{ margin: "0 0 14px" }}>Every call is added for you, and new ones appear on their own, with reminders a day, an hour and 10 minutes ahead.</p>
      <div className="cal-feed-btns">
        <a className="btn primary" href={google} target="_blank" rel="noreferrer">Add to Google Calendar</a>
        <a className="btn" href={webcal}>Add to Apple Calendar</a>
        <button type="button" className="btn" onClick={copy}>{copied ? "Link copied ✓" : "Copy link"}</button>
      </div>
      <p className="when" style={{ margin: "12px 0 0" }}>
        This link is just for you, so please don&apos;t share it. <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => dlg.current?.showModal()}>Make a new link</button>
      </p>
      <dialog ref={dlg} className="rs-dialog" aria-labelledby="cf-title">
        <h2 id="cf-title" className="qh" style={{ marginTop: 0 }}>Make a new link?</h2>
        <p>Your current link will stop working. You will need to add the calendar again with the new link.</p>
        <div className="dlg-actions">
          <button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button>
          <button className="btn primary" type="button" disabled={pending} onClick={reset}>{pending ? "Working…" : "Make a new link"}</button>
        </div>
      </dialog>
    </section>
  );
}
