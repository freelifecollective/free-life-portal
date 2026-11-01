"use client";

import { useActionState, useState } from "react";
import { saveHours, type HoursState } from "@/app/(app)/settings/availability/actions";
import { CALL_LENGTHS, DAYS, HALF_HOURS, hhmm, type Hours } from "@/lib/booking/times";

/** When you are open for coaching calls. Leads you brought in pick a time inside these hours. */
export function AvailabilityForm({ hours, minutes, tz, zones }: { hours: Hours[]; minutes: number; tz: string; zones: string[] }) {
  const [state, action, pending] = useActionState(saveHours, { error: "" } as HoursState);
  const by = new Map(hours.map((h) => [h.weekday, h]));
  const [on, setOn] = useState<boolean[]>(DAYS.map((_, d) => by.has(d)));
  return (
    <form action={action} className="set-form">
      <div className="row">
        <div className="field"><label htmlFor="av-len">How long is a call?</label>
          <select id="av-len" name="call_minutes" defaultValue={minutes}>{CALL_LENGTHS.map((m) => <option key={m} value={m}>{`${m} minutes`}</option>)}</select></div>
        <div className="field"><label htmlFor="av-tz">Your time zone</label>
          <select id="av-tz" name="tz" defaultValue={tz}>{zones.map((z) => <option key={z} value={z} data-i18n="skip">{z.replace(/_/g, " ")}</option>)}</select></div>
      </div>
      <fieldset className="av-days">
        <legend className="when">Tick the days you are open and choose your hours</legend>
        {DAYS.map((name, d) => {
          const h = by.get(d);
          return (
            <div key={name} className={"av-row" + (on[d] ? " on" : "")}>
              <label className="av-day"><input type="checkbox" name={`on_${d}`} checked={on[d]} onChange={(e) => setOn((cur) => cur.map((v, i) => (i === d ? e.target.checked : v)))} /> {name}</label>
              <select name={`from_${d}`} defaultValue={hhmm(h?.start_min ?? 540)} disabled={!on[d]} aria-label={`${name} from`}>{HALF_HOURS.filter((m) => m < 1440).map((m) => <option key={m} value={hhmm(m)}>{hhmm(m)}</option>)}</select>
              <span aria-hidden="true">–</span>
              <select name={`to_${d}`} defaultValue={h ? (h.end_min === 1440 ? "24:00" : hhmm(h.end_min)) : "17:00"} disabled={!on[d]} aria-label={`${name} to`}>{HALF_HOURS.filter((m) => m > 0).map((m) => <option key={m} value={m === 1440 ? "24:00" : hhmm(m)}>{m === 1440 ? "24:00" : hhmm(m)}</option>)}</select>
            </div>
          );
        })}
      </fieldset>
      <div className="set-actions"><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save my open hours"}</button><span role="status" className="when">{state.saved ? "Saved." : ""}</span></div>
      <p className="err" role="alert">{state.error}</p>
    </form>
  );
}
