"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMyCoach } from "@/app/(app)/settings/coach";

export type CoachOption = { id: string; name: string };

/** Who is your coach? So the portal knows who belongs to whom, and "message my coach" opens the right conversation. */
const OUTSIDE = "__outside";

export function MyCoach({ options, current, found, outside }: { options: CoachOption[]; current: string; found: string | null; outside: string }) {
  const router = useRouter();
  const [value, setValue] = useState(outside ? OUTSIDE : current);
  const [name, setName] = useState(outside);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="set-form" id="coach">
      <div className="field"><label htmlFor="my-coach">Your coach</label>
        <select id="my-coach" value={value} onChange={(e) => { setValue(e.target.value); setMsg(""); }}>
          <option value="">{found ? `${found} (found from the charts)` : "Not chosen yet"}</option>
          {options.map((o) => <option key={o.id} value={o.id} data-i18n="skip">{o.name}</option>)}
          <option value={OUTSIDE}>My coach is not in FLC</option>
        </select></div>
      {value === OUTSIDE ? (
        <div className="field"><label htmlFor="my-coach-name">Your coach&apos;s name</label>
          <input id="my-coach-name" value={name} maxLength={80} autoComplete="off" onChange={(e) => { setName(e.target.value); setMsg(""); }} /></div>
      ) : null}
      <div className="set-actions">
        <button type="button" className="btn small primary" disabled={pending || (value === OUTSIDE && !name.trim())} onClick={() => start(async () => { const r = await setMyCoach(value === OUTSIDE ? "" : value, value === OUTSIDE ? name : ""); setMsg(r.ok ? "Saved." : r.error ?? ""); router.refresh(); })}>{pending ? "Saving…" : "Save"}</button>
        <p className="when" role="status" style={{ margin: 0 }}>{msg}</p>
      </div>
    </div>
  );
}
