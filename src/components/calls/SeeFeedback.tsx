"use client";

import { useRef, useState } from "react";
import { loadFeedback, type FeedbackRow } from "@/app/(app)/calls/actions";
import { Avatar } from "@/components/Avatar";
import { formatInZone } from "@/lib/time";

/** "See what people are saying about this call". The list only fills in for people who have shared their own feedback, and for admins. */

export function SeeFeedback({ callId }: { callId: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  async function open() { dlg.current?.showModal(); setRows(null); const r = await loadFeedback(callId); setRows(r.rows); }
  return (
    <>
      <button type="button" className="btn" onClick={open}>See what people are saying about this call</button>
      <dialog ref={dlg} className="rs-dialog doc-viewer" aria-labelledby="fb-title">
        <h2 id="fb-title" className="qh" style={{ marginTop: 0 }}>What people are saying</h2>
        {rows === null ? <p className="when">Loading…</p> : rows.length === 0 ? (
          <p>Feedback from other attendees unlocks once you have shared your own after joining a live call.</p>
        ) : (
          <ul className="fb-list">
            {rows.map((r, i) => (
              <li key={i}>
                <div className="who"><Avatar url={r.avatar_url} initials={(r.first_name ?? "?").charAt(0).toUpperCase()} size={32} /><strong>{[r.first_name, r.last_name].filter(Boolean).join(" ")}</strong><span className="when">{formatInZone(new Date(r.created_at))}</span></div>
                <p><b>What I thought:</b> {r.thoughts}</p>
                <p><b>Favourite part:</b> {r.favourite}</p>
                <p><b>Biggest takeaway:</b> {r.takeaway}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="dlg-actions"><button className="btn primary" type="button" onClick={() => dlg.current?.close()}>Close</button></div>
      </dialog>
    </>
  );
}
