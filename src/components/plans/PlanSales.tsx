"use client";

import { plansBelow, type Plan } from "@/lib/plans";

type Props = {
  plan: Plan;
  /** what this person pays: $33 for founders on Starter */
  price: number;
  count: number;
  mine: boolean;
  thanks: boolean;
  pending: boolean;
  onBack: () => void;
  onChoose: () => void;
};

/** The sales page for one plan. It replaces the three plan cards until "Take me back to the other plans" is pressed. */
export function PlanSales({ plan, price, count, mine, thanks, pending, onBack, onChoose }: Props) {
  const below = plansBelow(plan.tier);
  const prev = below[below.length - 1];

  const action = mine ? (
    <p className="pl-yours">This is your plan ✓</p>
  ) : thanks ? (
    <p className="pl-yours" role="status">Thank you! Checkout is opening soon. We have noted that you want this plan.</p>
  ) : (
    <button type="button" className="btn primary ps-cta" disabled={pending} onClick={onChoose}>{`Join ${plan.name} for $${price}/month`}</button>
  );

  return (
    <article className="ps" aria-label={`${plan.name} plan`}>
      <button type="button" className="ps-back" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        <span>Take me back to the other plans</span>
      </button>

      <header className="ps-hero">
        <p className="ps-eyebrow"><span translate="no">{plan.name}</span>{plan.popular ? <span className="pl-flag ps-flag">Most popular</span> : null}</p>
        <h2 className="qh ps-headline">{plan.headline}</h2>
        <p className="ps-pitch">{plan.pitch}</p>
        <div className="ps-buy">
          <p className="pl-price"><b>${price}</b><span>/month</span>{price !== plan.tier ? <s className="pl-was">${plan.tier}</s> : null}</p>
          {price !== plan.tier ? <p className="pl-founder">Your founders price</p> : null}
          <p className="pl-count">{count === 1 ? "1 paying member on this plan" : `${count} paying members on this plan`}</p>
          {action}
        </div>
      </header>

      <section className="ps-section" aria-labelledby="ps-inc">
        <h3 id="ps-inc" className="qh ps-h">{prev ? `Everything in ${prev.name}, plus:` : "What's included"}</h3>
        <div className="ps-grid">
          {plan.includes.map((f) => (
            <div key={f.name} className="ps-feature">
              <h4>{f.name}</h4>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
        {below.length ? (
          <div className="ps-also">
            {below.map((b) => (
              <div key={b.tier}>
                <p className="ps-also-h">{`Also included from ${b.name}`}</p>
                <ul>{b.includes.map((f) => <li key={f.name}>{f.name}</li>)}</ul>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="ps-section" aria-labelledby="ps-for">
        <h3 id="ps-for" className="qh ps-h">{`${plan.name} is for you if...`}</h3>
        <ul className="ps-for">{plan.forWho.map((w) => <li key={w}>{w}</li>)}</ul>
      </section>

      <section className="ps-final">
        <h3 className="qh">{`Ready to start with ${plan.name}?`}</h3>
        <p className="pl-price"><b>${price}</b><span>/month</span>{price !== plan.tier ? <s className="pl-was">${plan.tier}</s> : null}</p>
        <p className="when">You can change your plan later.</p>
        {action}
      </section>
    </article>
  );
}
