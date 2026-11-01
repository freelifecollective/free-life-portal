"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endHire } from "@/app/(app)/call-closers/actions";
import { setPaused } from "@/app/(app)/call-closer/actions";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/people/ProfilePopup";

export type Client = { id: string; member_id: string; name: string; avatar_url: string | null; calls_total: number | null; calls_used: number };

/** The people you take calls for now, each with a button to let them go. */
export function ClientList({ clients, paused }: { clients: Client[]; paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState<string | null>(null);
  return (
    <section className="card-s ch-clients" aria-label="Current clients">
      <h2 className="qh" style={{ margin: 0 }}>Current clients</h2>
      <div className="ch-pause">
        <div>
          <b>{paused ? "You are not taking new clients" : "You are taking new clients"}</b>
          <p className="when" style={{ margin: "2px 0 0" }}>{paused ? "Your card stays in Call Closers for Hire, but the Hire button says Not Currently Booking. People can ask to be told when you are back." : "Pause new clients any time. Your card stays in Call Closers for Hire and the people you already work with are not affected."}</p>
        </div>
        <button type="button" className={"btn small" + (paused ? " primary" : "")} disabled={pending} onClick={() => start(async () => { await setPaused(!paused); router.refresh(); })}>{paused ? "Start taking clients again" : "Pause new clients"}</button>
      </div>
      {clients.length === 0 ? <p className="when" style={{ margin: 0 }}>No clients right now. When someone hires you and you accept, they show up here.</p> : null}
      <ul>
        {clients.map((c) => (
          <li key={c.id}>
            <PersonLink id={c.member_id} name={c.name} className="who"><Avatar url={c.avatar_url} initials={c.name.charAt(0).toUpperCase()} size={36} /><span className="who-name"><strong>{c.name}</strong><small>{c.calls_total === null ? "All their future calls" : `${c.calls_total - c.calls_used} of ${c.calls_total} calls left`}</small></span></PersonLink>
            {asking === c.id ? (
              <span className="ch-ask">Let go? <button type="button" disabled={pending} onClick={() => start(async () => { await endHire(c.id); setAsking(null); router.refresh(); })}>Yes</button><button type="button" onClick={() => setAsking(null)}>No</button></span>
            ) : (
              <button type="button" className="btn small" onClick={() => setAsking(c.id)}>Let go</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
