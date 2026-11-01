"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endHire, respondHire } from "@/app/(app)/call-closers/actions";
import { PersonLink } from "@/components/people/ProfilePopup";
import { Avatar } from "@/components/Avatar";

export type Request = { id: string; member_id: string; name: string; avatar_url: string | null; calls_total: number | null; calls_used: number; note: string | null; status: "pending" | "active" };

const what = (r: Request) => (r.calls_total === 1 ? "one call" : r.calls_total === 2 ? "two calls" : "all their future calls");

/** For call closers: who wants to hire you (accept or decline), and who you are taking calls for now. */
export function HireRequests({ requests }: { requests: Request[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  if (requests.length === 0) return null;
  const waiting = requests.filter((r) => r.status === "pending");
  const active = requests.filter((r) => r.status === "active");
  const answer = (id: string, accept: boolean) => start(async () => {
    setError("");
    const r = await respondHire(id, accept, notes[id] ?? "");
    if (!r.ok) setError(r.error ?? "That did not work."); else router.refresh();
  });
  const person = (r: Request) => <PersonLink id={r.member_id} name={r.name} className="who"><Avatar url={r.avatar_url} initials={r.name.charAt(0).toUpperCase()} size={44} /><span className="who-name"><strong>{r.name}</strong></span></PersonLink>;
  return (
    <section className="card-s" aria-label="Hire requests" style={{ display: "grid", gap: 14 }}>
      {waiting.length ? <h2 className="qh" style={{ margin: 0 }}>{`Hire requests · ${waiting.length}`}</h2> : null}
      {waiting.map((r) => (
        <div key={r.id} style={{ display: "grid", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          {person(r)}
          <p style={{ margin: 0 }}>{`Wants to hire you for ${what(r)}.`}</p>
          {r.note ? <p className="when" style={{ margin: 0 }}>{`Their note: ${r.note}`}</p> : null}
          <input type="text" maxLength={200} placeholder="A note for them (optional)" aria-label="A note for them" value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} style={{ font: "inherit", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }} />
          <div className="rs-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn small primary" disabled={pending} onClick={() => answer(r.id, true)}>Accept</button>
            <button type="button" className="btn small" disabled={pending} onClick={() => answer(r.id, false)}>Decline</button>
          </div>
        </div>
      ))}
      {active.length ? <h2 className="qh" style={{ margin: 0 }}>You are taking calls for</h2> : null}
      {active.map((r) => (
        <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>{person(r)}<span className="when">{r.calls_total === null ? "All their future calls" : `${r.calls_total - r.calls_used} of ${r.calls_total} calls left`}</span></div>
          <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { await endHire(r.id); router.refresh(); })}>Stop taking their calls</button>
        </div>
      ))}
      {error ? <p className="err" role="alert" style={{ minHeight: 0, margin: 0 }}>{error}</p> : null}
    </section>
  );
}
