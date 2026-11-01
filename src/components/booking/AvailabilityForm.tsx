"use client";

import { useActionState, useState } from "react";
import { saveHours, type HoursState } from "@/app/(app)/settings/availability/actions";
import { BUFFERS, CALL_LENGTHS, DAYS, DAYS_AHEAD, HALF_HOURS, INTERVALS, NOTICE_HOURS, PER_DAY, hhmm, type Hours, type Rules } from "@/lib/booking/times";

const pretty = (hm: string) => { const [h, m] = hm.split(":").map(Number); const hh = h % 24; return `${hh % 12 || 12}:${String(m).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`; };
const noticeLabel = (h: number) => (h === 0 ? "No notice" : h < 24 ? `${h} hour${h === 1 ? "" : "s"}` : `${h / 24} day${h === 24 ? "" : "s"}`);
const mins = (n: number) => `${n} minutes`;

/**
 * Your availability, like GoHighLevel: the week's hours on top (tap Edit to change them, and copy one day's hours to other days),
 * the booking rules underneath, and one Save.
 */
export function AvailabilityForm({ hours, rules, tz, zones }: { hours: Hours[]; rules: Rules; tz: string; zones: string[] }) {
  const [state, action, pending] = useActionState(saveHours, { error: "" } as HoursState);
  const by = new Map(hours.map((h) => [h.weekday, h]));
  const [editing, setEditing] = useState(false);
  const [on, setOn] = useState<boolean[]>(DAYS.map((_, d) => by.has(d)));
  const [times, setTimes] = useState<{ from: string; to: string }[]>(DAYS.map((_, d) => { const h = by.get(d); return { from: hhmm(h?.start_min ?? 540), to: h ? (h.end_min === 1440 ? "24:00" : hhmm(h.end_min)) : "17:00" }; }));
  const [copying, setCopying] = useState<number | null>(null);
  const [targets, setTargets] = useState<boolean[]>(DAYS.map(() => false));
  const copy = () => {
    if (copying === null) return;
    setTimes((cur) => cur.map((t, i) => (targets[i] ? cur[copying] : t)));
    setOn((cur) => cur.map((v, i) => v || targets[i]));
    setCopying(null); setTargets(DAYS.map(() => false));
  };
  return (
    <form action={action} className="av">
      <section className="av-card">
        <div className="av-head">
          <h2>Weekly hours</h2>
          <button type="button" className="av-edit" onClick={() => { setEditing(!editing); setCopying(null); }}>{editing ? "Done" : "✎ Edit"}</button>
        </div>
        <div className="av-tz">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
          {editing ? <select name="tz" defaultValue={tz} aria-label="Your time zone">{zones.map((z) => <option key={z} value={z} data-i18n="skip">{z.replace(/_/g, " ")}</option>)}</select> : <span data-i18n="skip">{tz.replace(/_/g, " ")}</span>}
        </div>
        {/* when the editor is closed the hours are still sent along, so saving never loses them */}
        {!editing ? <input type="hidden" name="tz" value={tz} /> : null}
        <ul className="av-list">
          {DAYS.map((name, d) => (
            <li key={name} className={on[d] ? "" : "off"}>
              <span className="av-d">{name.slice(0, 3)}</span>
              {!editing ? (
                <>
                  <span className="av-t">{on[d] ? `${pretty(times[d].from)} – ${pretty(times[d].to)}` : "Unavailable"}</span>
                  {on[d] ? <><input type="hidden" name={`on_${d}`} value="on" /><input type="hidden" name={`from_${d}`} value={times[d].from} /><input type="hidden" name={`to_${d}`} value={times[d].to} /></> : null}
                </>
              ) : (
                <>
                  <label className="av-on"><input type="checkbox" name={`on_${d}`} checked={on[d]} onChange={(e) => setOn((cur) => cur.map((v, i) => (i === d ? e.target.checked : v)))} /><span className="sr-only">{name} open</span></label>
                  <select name={`from_${d}`} value={times[d].from} onChange={(e) => setTimes((cur) => cur.map((t, i) => (i === d ? { ...t, from: e.target.value } : t)))} disabled={!on[d]} aria-label={`${name} from`}>{HALF_HOURS.filter((m) => m < 1440).map((m) => <option key={m} value={hhmm(m)}>{pretty(hhmm(m))}</option>)}</select>
                  <span aria-hidden="true">–</span>
                  <select name={`to_${d}`} value={times[d].to} onChange={(e) => setTimes((cur) => cur.map((t, i) => (i === d ? { ...t, to: e.target.value } : t)))} disabled={!on[d]} aria-label={`${name} to`}>{HALF_HOURS.filter((m) => m > 0).map((m) => <option key={m} value={m === 1440 ? "24:00" : hhmm(m)}>{m === 1440 ? "12:00 AM" : pretty(hhmm(m))}</option>)}</select>
                  <button type="button" className="av-copy" disabled={!on[d]} onClick={() => { setCopying(copying === d ? null : d); setTargets(DAYS.map(() => false)); }}>Copy to other days</button>
                  {copying === d ? (
                    <div className="av-copybox" role="group" aria-label={`Copy ${name} hours to`}>
                      <span className="when">Copy these hours to:</span>
                      {DAYS.map((n, i) => i === d ? null : (
                        <label key={n}><input type="checkbox" checked={targets[i]} onChange={(e) => setTargets((cur) => cur.map((v, j) => (j === i ? e.target.checked : v)))} /> {n}</label>
                      ))}
                      <span className="av-copyact"><button type="button" className="btn small" onClick={() => setCopying(null)}>Cancel</button><button type="button" className="btn small primary" disabled={!targets.some(Boolean)} onClick={copy}>Copy</button></span>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="av-card">
        <div className="av-head"><div><h2>Booking rules</h2><p className="when">Control how and when calls can be booked.</p></div></div>
        <div className="av-rules">
          <label>Meeting duration<select name="call_minutes" defaultValue={rules.call_minutes}>{CALL_LENGTHS.map((m) => <option key={m} value={m}>{mins(m)}</option>)}</select></label>
          <label>Meeting interval<select name="interval_minutes" defaultValue={rules.interval_minutes ?? ""}><option value="">Same as duration</option>{INTERVALS.map((m) => <option key={m} value={m}>{mins(m)}</option>)}</select></label>
          <label>Minimum scheduling notice<select name="min_notice_hours" defaultValue={rules.min_notice_hours}>{NOTICE_HOURS.map((h) => <option key={h} value={h}>{noticeLabel(h)}</option>)}</select></label>
          <label>Date range<select name="max_days_ahead" defaultValue={rules.max_days_ahead}>{DAYS_AHEAD.map((n) => <option key={n} value={n}>{`${n} days ahead`}</option>)}</select></label>
          <label>Pre buffer time<select name="buffer_before" defaultValue={rules.buffer_before}>{BUFFERS.map((m) => <option key={m} value={m}>{m === 0 ? "None" : mins(m)}</option>)}</select></label>
          <label>Post buffer time<select name="buffer_after" defaultValue={rules.buffer_after}>{BUFFERS.map((m) => <option key={m} value={m}>{m === 0 ? "None" : mins(m)}</option>)}</select></label>
          <label>Maximum bookings per day<select name="max_per_day" defaultValue={rules.max_per_day ?? ""}><option value="">No limit</option>{PER_DAY.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
      </section>
      <div className="av-save"><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save my availability"}</button><span role="status" className="when">{state.saved ? "Saved." : ""}</span></div>
      <p className="err" role="alert" style={{ minHeight: 0, margin: 0 }}>{state.error}</p>
    </form>
  );
}
