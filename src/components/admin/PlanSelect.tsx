"use client";

import { useState, useTransition } from "react";
import { setPlan } from "@/app/(app)/admin/people/actions";

/** Which plan a paying member is on. Counts on the sales page come from this. */
export function PlanSelect({ id, name, plan }: { id: string; name: string; plan: number | null }) {
  const [value, setValue] = useState(plan === null ? "" : String(plan));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="inline-form">
      <label className="sr-only" htmlFor={`plan-${id}`}>Plan for {name}</label>
      <select id={`plan-${id}`} value={value} disabled={pending} onChange={(e) => { const v = e.target.value; setValue(v); setSaved(false); start(async () => { const r = await setPlan(id, v); if (r.ok) setSaved(true); else setValue(plan === null ? "" : String(plan)); }); }}>
        <option value="">No plan</option><option value="47">$47</option><option value="77">$77</option><option value="297">$297</option>
      </select>
      {saved ? <span className="muted-line">Saved ✓</span> : null}
    </span>
  );
}
