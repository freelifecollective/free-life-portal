"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMyCoach } from "@/app/(app)/settings/coach";

export type CoachOption = { id: string; name: string };

/** Who is your coach? So the portal knows who belongs to whom, and "message my coach" opens the right conversation. */
export function MyCoach({ options, current, found }: { options: CoachOption[]; current: string; found: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="set-form" id="coach">
      <div className="field"><label htmlFor="my-coach">Your coach</label>
        <select id="my-coach" value={value} onChange={(e) => { setValue(e.target.value); setMsg(""); }}>
          <option value="">{found ? `${found} (found from the charts)` : "Not chosen yet"}</option>
          {options.map((o) => <option key={o.id} value={o.id} data-i18n="skip">{o.name}</option>)}
        </select></div>
      <div className="set-actions">
        <button type="button" className="btn small primary" disabled={pending} onClick={() => start(async () => { const r = await setMyCoach(value); setMsg(r.ok ? "Saved." : r.error ?? ""); router.refresh(); })}>{pending ? "Saving…" : "Save"}</button>
        <p className="when" role="status" style={{ margin: 0 }}>{msg}</p>
      </div>
    </div>
  );
}
