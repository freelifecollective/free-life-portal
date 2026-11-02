"use client";

import { useRouter } from "next/navigation";

/** Pick an FLC member to show only their leads (or the leads nobody has yet). */
export function LeadMemberFilter({ options, current }: { options: { id: string; name: string; count: number }[]; current: string }) {
  const router = useRouter();
  return (
    <div className="field" style={{ maxWidth: 360, margin: "0 0 14px" }}>
      <label htmlFor="lead-member">Show the leads of</label>
      <select id="lead-member" value={current} onChange={(e) => router.push(e.target.value ? `/admin/people?view=leads&member=${e.target.value}` : "/admin/people?view=leads")}>
        <option value="">Everyone (all leads)</option>
        <option value="none">No one yet</option>
        {options.map((o) => <option key={o.id} value={o.id} data-i18n="skip">{`${o.name} (${o.count})`}</option>)}
      </select>
    </div>
  );
}
