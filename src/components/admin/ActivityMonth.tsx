"use client";

import { useRouter } from "next/navigation";

/** Pick which month of the activity log to look at. */
export function ActivityMonth({ months, current }: { months: { value: string; label: string }[]; current: string }) {
  const router = useRouter();
  return (
    <div className="field act-month">
      <label htmlFor="act-month">Month</label>
      <select id="act-month" value={current} onChange={(e) => router.push(`/admin/activity?m=${e.target.value}`)}>
        {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </div>
  );
}
