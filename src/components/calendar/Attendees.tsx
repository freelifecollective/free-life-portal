"use client";

import { useRef } from "react";
import { Avatar } from "@/components/Avatar";
import type { RsvpSummary } from "@/lib/calls/types";

const SHOWN = 8;

/** A row of picture bubbles plus counts. Pressing it lists everyone who has RSVPed. */
export function Attendees({ summary }: { summary: RsvpSummary }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const total = summary.live + summary.recording;
  if (total === 0) return <p className="attendees-empty">Be the first to RSVP.</p>;
  const shown = summary.people.slice(0, SHOWN);
  const more = total - shown.length;
  return (
    <div className="attendees">
      <button type="button" className="attendees-btn" onClick={() => dlg.current?.showModal()} aria-label="See everyone who has RSVPed">
        <ul className="bubbles" aria-hidden="true">
          {shown.map((p, i) => (
            <li key={(p.username ?? "") + i} title={p.name}>
              <Avatar url={p.avatar_url} initials={(p.name || "?").charAt(0).toUpperCase()} size={36} label={p.name} />
            </li>
          ))}
          {more > 0 ? <li className="bubble-more">+{more}</li> : null}
        </ul>
        <span className="attendee-count">
          {summary.live} coming live{summary.recording ? `, ${summary.recording} watching the recording` : ""}
        </span>
      </button>
      <dialog ref={dlg} className="rs-dialog" aria-labelledby="att-title">
        <h2 id="att-title" className="qh" style={{ marginTop: 0 }}>Who is coming</h2>
        {(["live", "recording"] as const).map((mode) => {
          const people = summary.people.filter((p) => p.mode === mode);
          const count = mode === "live" ? summary.live : summary.recording;
          if (!count) return null;
          return (
            <section key={mode} className="att-group">
              <h3 className="day-label" style={{ margin: "14px 0 8px" }}>{mode === "live" ? "Coming live" : "Watching the recording"} · {count}</h3>
              <ul className="att-list">
                {people.map((p, i) => (
                  <li key={(p.username ?? "") + i}>
                    <Avatar url={p.avatar_url} initials={(p.name || "?").charAt(0).toUpperCase()} size={32} label={p.name} />
                    <span>{p.name || "Member"}</span>
                  </li>
                ))}
              </ul>
              {count > people.length ? <p className="when">and {count - people.length} more</p> : null}
            </section>
          );
        })}
        <div className="dlg-actions"><button className="btn primary" type="button" onClick={() => dlg.current?.close()}>Close</button></div>
      </dialog>
    </div>
  );
}
