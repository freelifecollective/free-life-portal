"use client";

import { useState, useTransition } from "react";
import { setPlan, setPlanFlag } from "@/app/(app)/admin/people/actions";

/**
 * Which plan a paying member is on, whether they have the $33 founders price, and whether they are part of Lacey's Downline
 * (which version of each plan they get). Counts on the sales page and what each member can open come from this.
 */
export function PlanSelect({ id, name, plan, founder, downline }: { id: string; name: string; plan: number | null; founder: boolean; downline: boolean }) {
  const [value, setValue] = useState(plan === null ? "" : String(plan));
  const [isFounder, setFounder] = useState(founder);
  const [isDownline, setDownline] = useState(downline);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const flag = (which: "founder" | "lacey_downline", on: boolean, set: (v: boolean) => void) => {
    set(on); setSaved(false);
    start(async () => { const r = await setPlanFlag(id, which, on); if (r.ok) setSaved(true); else set(!on); });
  };

  return (
    <span className="inline-form plan-select">
      <label className="sr-only" htmlFor={`plan-${id}`}>Plan for {name}</label>
      <select id={`plan-${id}`} value={value} disabled={pending} onChange={(e) => { const v = e.target.value; setValue(v); setSaved(false); start(async () => { const r = await setPlan(id, v); if (r.ok) setSaved(true); else setValue(plan === null ? "" : String(plan)); }); }}>
        <option value="">No plan</option><option value="47">{isFounder ? "$33 (founder)" : "$47"}</option><option value="97">$97</option><option value="297">$297</option>
      </select>
      <label className="check-inline"><input type="checkbox" checked={isFounder} disabled={pending} onChange={(e) => flag("founder", e.target.checked, setFounder)} /> Founder</label>
      <label className="check-inline"><input type="checkbox" checked={isDownline} disabled={pending} onChange={(e) => flag("lacey_downline", e.target.checked, setDownline)} /> Lacey&apos;s Downline</label>
      {saved ? <span className="muted-line">Saved ✓</span> : null}
    </span>
  );
}
