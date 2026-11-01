"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { markPaid, setPaused } from "@/app/(app)/call-closer/actions";
import { PersonLink } from "@/components/people/ProfilePopup";
import { Avatar } from "@/components/Avatar";
import { money, type PayRule } from "@/lib/closer/pay";
import { owedOf, totalOf, type HubCall } from "@/lib/closer/types";
import { formatInZone } from "@/lib/time";
import { CallEditor } from "./CallEditor";
import { PayRules } from "./PayRules";

export type Person = { id: string; name: string; avatar_url: string | null };
export type Stats = { calls: string; recorded: number; closed: number; closeRate: string; rating: number | null; reviews: number; members: string };

const who = (p: Person | undefined) => p?.name ?? "A member";
const PersonChip = ({ p, id }: { p: Person | undefined; id: string }) => <PersonLink id={id} name={who(p)} className="who"><Avatar url={p?.avatar_url ?? null} initials={who(p).charAt(0).toUpperCase()} size={32} /><span className="who-name"><strong>{who(p)}</strong></span></PersonLink>;

/** The call closer's own area. */
export function CloserHub({ availability, clients, paused, calls, people, rules, stats, price, now }: { availability?: ReactNode; clients?: ReactNode; now: number; paused: boolean; calls: HubCall[]; people: Record<string, Person>; rules: PayRule[]; stats: Stats; price: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const upcoming = calls.filter((c) => new Date(c.starts_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = calls.filter((c) => new Date(c.starts_at).getTime() <= now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const owing = past.filter((c) => c.outcome === "took_place" && owedOf(c) > 0);
  const byMember = new Map<string, HubCall[]>();
  for (const c of owing) byMember.set(c.member_id, [...(byMember.get(c.member_id) ?? []), c]);
  const cur = (c: HubCall) => c.pay_currency ?? "USD";
  const editCall = calls.find((c) => c.id === editing);
  const status = (c: HubCall) => c.outcome === null ? "Not recorded yet" : c.outcome === "no_show" ? "Did not take place" : owedOf(c) <= 0 && c.paid_at ? "Paid" : "Took place";

  return (
    <div className="stack ch" style={{ maxWidth: 1160 }}>
      <div className="ch-top">
        <div>{availability}</div>
      <div className="ch-side">
      <section className="card-s ch-pause" aria-label="New clients">
          <div>
            <h2 className="qh" style={{ margin: 0 }}>{paused ? "You are not taking new clients" : "You are taking new clients"}</h2>
            <p className="when" style={{ margin: "4px 0 0" }}>{paused ? "Your card is still in Call Closers for Hire, but the Hire button says Not Currently Booking. People can ask to be told when you are back." : "Pause new clients any time. Your card stays in Call Closers for Hire and the people you already work with are not affected."}</p>
          </div>
          <button type="button" className={"btn" + (paused ? " primary" : "")} disabled={pending} onClick={() => start(async () => { await setPaused(!paused); router.refresh(); })}>{paused ? "Start taking clients again" : "Pause new clients"}</button>
        </section>
        {clients}
      <section className="card-s" aria-label="Upcoming calls">
        <h2 className="qh" style={{ marginTop: 0 }}>{`Upcoming calls · ${upcoming.length}`}</h2>
        {upcoming.length === 0 ? <p style={{ margin: 0 }}>No calls booked with you yet.</p> : (
          <ul className="ch-list">
            {upcoming.map((c) => (
              <li key={c.id}>
                <div><strong translate="no">{c.lead_name}</strong><br /><span className="when" translate="no">{formatInZone(new Date(c.starts_at))}</span></div>
                <div className="ch-for"><span className="when">For</span><PersonChip p={people[c.member_id]} id={c.member_id} /></div>
                {c.note ? <p className="when" style={{ margin: 0, flexBasis: "100%" }} translate="no">{c.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card-s" aria-label="Money owed to you">
        <h2 className="qh" style={{ marginTop: 0 }}>Money owed to you</h2>
        {byMember.size === 0 ? <p style={{ margin: 0 }}>Nothing is owed to you right now.</p> : (
          <div style={{ display: "grid", gap: 16 }}>
            {[...byMember.entries()].map(([memberId, list]) => {
              const sums = new Map<string, number>();
              for (const c of list) sums.set(cur(c), (sums.get(cur(c)) ?? 0) + owedOf(c));
              return (
                <div key={memberId} className="ch-owe">
                  <div className="ch-owe-head"><PersonChip p={people[memberId]} id={memberId} /><b>{[...sums.entries()].map(([k, v]) => money(v, k)).join(" + ")}</b></div>
                  <ul className="ch-list">
                    {list.map((c) => (
                      <li key={c.id}>
                        <div><span translate="no">{c.lead_name}</span> <span className="when" translate="no">{formatInZone(new Date(c.starts_at))}</span></div>
                        <div className="ch-act"><b>{money(owedOf(c), cur(c))}</b>{c.paid_cents > 0 ? <span className="when">{`(${money(c.paid_cents, cur(c))} already paid)`}</span> : null}
                          <button type="button" className="btn small primary" disabled={pending} onClick={() => start(async () => { await markPaid(c.id, true); router.refresh(); })}>Mark as paid</button></div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {past.some((c) => c.outcome === "took_place" && owedOf(c) <= 0 && c.paid_cents > 0) ? (
          <details style={{ marginTop: 14 }}><summary className="when" style={{ cursor: "pointer" }}>Paid calls</summary>
            <ul className="ch-list">{past.filter((c) => c.outcome === "took_place" && owedOf(c) <= 0 && c.paid_cents > 0).map((c) => (
              <li key={c.id}><div><span translate="no">{c.lead_name}</span> <span className="when">{`for ${who(people[c.member_id])}`}</span></div>
                <div className="ch-act"><b>{money(c.paid_cents, cur(c))}</b><button type="button" className="linkbtn" disabled={pending} onClick={() => start(async () => { await markPaid(c.id, false); router.refresh(); })}>Undo</button></div></li>
            ))}</ul></details>
        ) : null}
      </section>
        </div>
      </div>

      <section className="card-s" aria-label="Your stats">
        <h2 className="qh" style={{ marginTop: 0 }}>Your stats</h2>
        <div className="ch-stats">
          <p><b>{stats.calls}</b><span>Calls taken</span></p>
          <p><b>{stats.closeRate}</b><span>Close rate</span></p>
          <p><b>{stats.rating ? `★ ${stats.rating}` : "–"}</b><span>{`Reviews (${stats.reviews})`}</span></p>
          <p><b>{stats.members}</b><span>FLC members booked</span></p>
        </div>
        {stats.recorded > 0 ? <p className="when" style={{ margin: "10px 0 0" }}>{`From the calls you recorded here: ${stats.closed} of ${stats.recorded} led to a sale.`}</p> : null}
      </section>


      <section className="card-s" aria-label="Past calls">
        <h2 className="qh" style={{ marginTop: 0 }}>Past calls</h2>
        {past.length === 0 ? <p style={{ margin: 0 }}>Calls you have taken will show here.</p> : (
          <ul className="ch-list">
            {past.map((c) => (
              <li key={c.id}>
                <div><strong translate="no">{c.lead_name}</strong><br /><span className="when" translate="no">{formatInZone(new Date(c.starts_at))}</span></div>
                <div className="ch-for"><span className="when">For</span><PersonChip p={people[c.member_id]} id={c.member_id} /></div>
                <div className="ch-act">
                  <span className={"tag" + (c.outcome === null ? "" : " tag-dark")}>{status(c)}</span>
                  {c.outcome === "took_place" ? <span className="when">{money(totalOf(c), cur(c))}</span> : null}
                  <button type="button" className="btn small" onClick={() => setEditing(c.id)}>{c.outcome === null ? "Record this call" : "Edit"}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>


      <section className="card-s" aria-label="How you are paid">
        <h2 className="qh" style={{ marginTop: 0 }}>How you are paid</h2>
        <p className="when" style={{ marginTop: 0 }}>{price !== null ? `Your call price is ${money(price, "USD")} (an admin can change it). ` : "An admin sets your call price. "}For products, set a rule for each group of ranks. The rank is the rank of the affiliate who hired you.</p>
        <PayRules rules={rules} />
      </section>

      {editCall ? <CallEditor key={editCall.id + editCall.outcome + totalOf(editCall)} call={editCall} forName={who(people[editCall.member_id])} rules={rules} open onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
