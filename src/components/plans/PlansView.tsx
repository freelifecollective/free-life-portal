"use client";

import { useEffect, useState, useTransition } from "react";
import { choosePlan } from "@/app/(app)/plans/actions";
import { PLANS, isPlanTier, type PlanTier } from "@/lib/plans";
import { PlanSales } from "./PlanSales";

export type Bubble = { name: string; tier: number; at: string };

/** Reads ?plan=97 from the address, so a sales page can be linked to and survives a refresh. */
function planFromUrl(): PlanTier | null {
  if (typeof window === "undefined") return null;
  const n = Number(new URLSearchParams(window.location.search).get("plan"));
  return isPlanTier(n) ? n : null;
}

/**
 * The three plans side by side, how many members are on each, and a small bubble in the corner showing real recent sign-ups.
 * "Choose this plan" swaps the cards for that plan's sales page; its back button brings the cards back.
 */
export function PlansView({ counts, bubbles, mine }: { counts: Record<number, number>; bubbles: Bubble[]; mine: number | null }) {
  const [pending, start] = useTransition();
  const [thanks, setThanks] = useState<PlanTier | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [open, setOpen] = useState<PlanTier | null>(null);

  /* the open sales page follows the address bar, so the browser's own back button works too */
  useEffect(() => {
    setOpen(planFromUrl());
    const onPop = () => setOpen(planFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const show = (tier: PlanTier | null) => {
    const url = new URL(window.location.href);
    if (tier) url.searchParams.set("plan", String(tier)); else url.searchParams.delete("plan");
    window.history.pushState(null, "", url);
    setOpen(tier);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choose = (tier: PlanTier) => start(async () => { const r = await choosePlan(tier); if (r.ok) setThanks(tier); });

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
  const plan = open ? PLANS.find((p) => p.tier === open) ?? null : null;
  return (
    <>
      {plan ? (
        <PlanSales
          plan={plan}
          count={counts[plan.tier] ?? 0}
          mine={mine === plan.tier}
          thanks={thanks === plan.tier}
          pending={pending}
          onBack={() => show(null)}
          onChoose={() => choose(plan.tier)}
        />
      ) : (
        <div className="pl-grid">
          {PLANS.map((p) => (
            <section key={p.tier} className={"pl-card" + (p.popular ? " popular" : "")} aria-label={`${p.name} plan`}>
              {p.popular ? <span className="pl-flag">Most popular</span> : null}
              <h2 className="qh pl-name">{p.name}</h2>
              <p className="pl-price"><b>${p.tier}</b><span>/month</span></p>
              <p className="pl-count">{(counts[p.tier] ?? 0) === 1 ? "1 paying member on this plan" : `${counts[p.tier] ?? 0} paying members on this plan`}</p>
              <p className="when" style={{ margin: "0 0 10px" }}>{p.blurb}</p>
              <ul className="pl-list">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              {mine === p.tier ? <p className="pl-yours">This is your plan ✓</p> : null}
              <button type="button" className={"btn" + (mine === p.tier ? "" : " primary")} onClick={() => show(p.tier)}>{mine === p.tier ? "See what's included" : "Choose this plan"}</button>
            </section>
          ))}
        </div>
      )}
      {b ? (
        <div className="pl-bubble" role="status" aria-live="polite">
          <span aria-hidden="true">🎉</span>
          <span><b translate="no">{b.name}</b>{" just purchased the $" + b.tier + " account"}</span>
        </div>
      ) : null}
    </>
  );
}
