"use client";

import { useEffect, useState, useTransition } from "react";
import { choosePlan } from "@/app/(app)/plans/actions";
import { PLANS, type PlanTier } from "@/lib/plans";

export type Bubble = { name: string; tier: number; at: string };

/** The three plans side by side, how many members are on each, and a small bubble in the corner showing real recent sign-ups. */
export function PlansView({ counts, bubbles, mine }: { counts: Record<number, number>; bubbles: Bubble[]; mine: number | null }) {
  const [pending, start] = useTransition();
  const [thanks, setThanks] = useState<PlanTier | null>(null);
  const [shown, setShown] = useState<number | null>(null);

  /* the bubble: appears after a few seconds, stays a few seconds, then the next one; real sign-ups only */
  useEffect(() => {
    if (bubbles.length === 0) return;
    let i = 0, alive = true;
    const timers: number[] = [];
    const cycle = () => {
      if (!alive) return;
      setShown(i % bubbles.length); i++;
      timers.push(window.setTimeout(() => { if (alive) setShown(null); }, 6000));
      timers.push(window.setTimeout(cycle, 14000));
    };
    timers.push(window.setTimeout(cycle, 3500));
    return () => { alive = false; timers.forEach(window.clearTimeout); };
  }, [bubbles]);

  const b = shown === null ? null : bubbles[shown];
  return (
    <>
      <div className="pl-grid">
        {PLANS.map((p) => (
          <section key={p.tier} className={"pl-card" + (p.popular ? " popular" : "")} aria-label={`${p.name} plan`}>
            {p.popular ? <span className="pl-flag">Most popular</span> : null}
            <h2 className="qh pl-name">{p.name}</h2>
            <p className="pl-price"><b>${p.tier}</b><span>/month</span></p>
            <p className="pl-count">{(counts[p.tier] ?? 0) === 1 ? "1 paying member on this plan" : `${counts[p.tier] ?? 0} paying members on this plan`}</p>
            <p className="when" style={{ margin: "0 0 10px" }}>{p.blurb}</p>
            <ul className="pl-list">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {mine === p.tier ? <p className="pl-yours">This is your plan ✓</p> : thanks === p.tier ? (
              <p className="pl-yours" role="status">Thank you! Checkout is opening soon. We have noted that you want this plan.</p>
            ) : (
              <button type="button" className="btn primary" disabled={pending} onClick={() => start(async () => { const r = await choosePlan(p.tier); if (r.ok) setThanks(p.tier); })}>Choose this plan</button>
            )}
          </section>
        ))}
      </div>
      {b ? (
        <div className="pl-bubble" role="status" aria-live="polite">
          <span aria-hidden="true">🎉</span>
          <span><b translate="no">{b.name}</b>{" just purchased the $" + b.tier + " account"}</span>
        </div>
      ) : null}
    </>
  );
}
