"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookCall, cancelBooking } from "@/app/(app)/book/actions";
import { RoomLink } from "@/components/room/RoomLink";

export type Mine = { id: string; starts_at: string };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Free times grouped by day, in the time zone of the device you are on. Pick one, confirm, done. */
export function BookingPicker({ nowIso, slots, mine, who, minutes, withCloser }: { nowIso: string; slots: string[]; mine: Mine[]; who: string; minutes: number; withCloser: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  /* free times by day (in the time zone of this device) */
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const iso of slots) { const k = dayKey(new Date(iso)); m.set(k, [...(m.get(k) ?? []), iso]); }
    return m;
  }, [slots]);
  const firstDay = slots.length ? new Date(slots[0]) : new Date(nowIso);
  const [month, setMonth] = useState(() => new Date(firstDay.getFullYear(), firstDay.getMonth(), 1));
  const [day, setDay] = useState<string | null>(slots.length ? dayKey(firstDay) : null);
  const today = new Date(nowIso);
  const lastSlot = slots.length ? new Date(slots[slots.length - 1]) : today;
  const canBack = month.getFullYear() * 12 + month.getMonth() > today.getFullYear() * 12 + today.getMonth();
  const canNext = month.getFullYear() * 12 + month.getMonth() < lastSlot.getFullYear() * 12 + lastSlot.getMonth();
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: first.getDay() }, () => null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);
  const dayTimes = day ? byDay.get(day) ?? [] : [];
  const dayLabel = dayTimes.length ? new Date(dayTimes[0]).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const full = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const confirm = () => start(async () => {
    if (!pick) return;
    setError("");
    const r = await bookCall(pick);
    if (!r.ok) { setError(r.error ?? "That did not work."); router.refresh(); return; }
    setPick(null); router.refresh();
  });

  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      {mine.length ? (
        <section className="card-s" aria-label="Your booked call">
          <h2 className="qh" style={{ marginTop: 0 }}>Your booked call</h2>
          {mine.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div><strong translate="no">{full(m.starts_at)}</strong><br /><span className="when">{`With ${who}`}</span></div>
              <div className="rs-actions" style={{ margin: 0 }}>
                <RoomLink id={m.id} startsAt={m.starts_at} nowIso={nowIso} minutes={minutes} />
                {new Date(m.starts_at).getTime() > new Date(nowIso).getTime() ? <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { await cancelBooking(m.id); router.refresh(); })}>Cancel this call</button> : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <section className="card-s" aria-label="Pick a time">
        <h2 className="qh" style={{ marginTop: 0 }}>{mine.length ? "Need a different time?" : "Pick a time"}</h2>
        <p className="when" style={{ marginTop: 0 }}>{`Calls are ${minutes} minutes with ${who}${withCloser ? ", who is taking calls for your coach" : ""}. Times are shown in your own time zone.`}</p>
        {slots.length === 0 ? <p style={{ margin: 0 }}>There are no free times coming up. Check back soon.</p> : (
          <div className="bk-cal">
            <div className="bk-month">
              <div className="bk-month-h">
                <button type="button" className="icon-btn" aria-label="Previous month" disabled={!canBack} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
                <h3 translate="no">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
                <button type="button" className="icon-btn" aria-label="Next month" disabled={!canNext} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
              </div>
              <div className="bk-grid" role="grid" aria-label="Choose a day">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <span key={w} className="bk-dow">{w}</span>)}
                {cells.map((d, i) => {
                  if (!d) return <span key={`e${i}`} />;
                  const k = dayKey(d);
                  const free = byDay.has(k);
                  return <button key={k} type="button" className={"bk-cell" + (free ? " free" : "") + (day === k ? " on" : "")} disabled={!free} aria-pressed={day === k} aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + (free ? "" : ", no times")} onClick={() => { setDay(k); setPick(null); }} translate="no">{d.getDate()}</button>;
                })}
              </div>
              <p className="when" style={{ margin: "10px 0 0" }}>Days in colour have free times.</p>
            </div>
            <div className="bk-times" aria-live="polite">
              {dayTimes.length ? (
                <>
                  <h3 translate="no">{dayLabel}</h3>
                  <div className="bk-col">{dayTimes.map((iso) => <button key={iso} type="button" className="bk-slot" aria-pressed={pick === iso} onClick={() => setPick(iso)} translate="no">{time(iso)}</button>)}</div>
                </>
              ) : <p className="when" style={{ margin: 0 }}>Choose a day to see the free times.</p>}
            </div>
          </div>
        )}
        {pick ? (
          <div className="card-s" style={{ marginTop: 16, background: "var(--tint)" }}>
            <p style={{ margin: "0 0 10px" }}><strong>Book this time?</strong><br /><span translate="no">{full(pick)}</span></p>
            <div className="rs-actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn primary" disabled={pending} onClick={confirm}>{pending ? "Booking…" : "Book my call"}</button>
              <button type="button" className="btn" onClick={() => setPick(null)}>Not now</button>
            </div>
          </div>
        ) : null}
        {error ? <p className="err" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
