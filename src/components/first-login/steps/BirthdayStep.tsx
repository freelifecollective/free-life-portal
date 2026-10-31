"use client";

import type { StepProps } from "../flow";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const BIRTH_YEARS = Array.from({ length: 2012 - 1930 + 1 }, (_, i) => 2012 - i);

/** Everything on this screen is optional: a birthday so the community can celebrate it, with or without the year. */
export function BirthdayStep({ f, set, go }: StepProps) {
  const days = f.bMonth ? new Date(2000, Number(f.bMonth), 0).getDate() : 31;
  const dayOk = !f.bDay || Number(f.bDay) <= days;
  const ready = (!f.bMonth && !f.bDay && !f.bYear) || (f.bMonth && f.bDay && dayOk);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    go("country");
  }
  function skip() {
    set({ bMonth: "", bDay: "", bYear: "" });
    go("country");
  }

  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>What&rsquo;s your birthday?</h1>
      <p className="page-lede" style={{ maxWidth: "none" }}>So we can celebrate you on your special day. This is optional, and so is the year.</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="bd-month">Month</label>
          <select id="bd-month" value={f.bMonth} onChange={(e) => set({ bMonth: e.target.value })}>
            <option value="">Choose a month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bd-day">Day</label>
          <select id="bd-day" value={f.bDay} onChange={(e) => set({ bDay: e.target.value })}>
            <option value="">Choose a day</option>
            {Array.from({ length: days }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bd-year">Year (optional)</label>
          <select id="bd-year" value={f.bYear} onChange={(e) => set({ bYear: e.target.value })}>
            <option value="">I would rather not say</option>
            {BIRTH_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className={"status" + (ready ? "" : " bad")} aria-live="polite">{ready ? "" : "Choose both a month and a day, or skip this for now."}</p>
        <div className="actions">
          <button className="btn primary" disabled={!ready} type="submit">Continue</button>
          <button className="linkbtn" type="button" onClick={skip}>Skip, I&rsquo;ll add it later</button>
        </div>
      </form>
    </section>
  );
}
