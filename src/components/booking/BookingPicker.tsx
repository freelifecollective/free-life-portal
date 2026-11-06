"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookCall, cancelBooking } from "@/app/(app)/book/actions";
import { Avatar } from "@/components/Avatar";
import { expectText } from "@/lib/booking/expect";
import { RoomLink } from "@/components/room/RoomLink";

export type Mine = { id: string; starts_at: string; person?: string; closer?: boolean };
export type Person = { name: string; avatar_url: string | null; bio: string | null; language?: string | null };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Free times grouped by day, in the time zone of the device you are on. Pick one, confirm, done. */
export function BookingPicker({ nowIso, slots, mine, who, minutes, withCloser, people = {} }: { nowIso: string; slots: string[]; mine: Mine[]; who: string; minutes: number; withCloser: boolean; people?: Record<string, Person> }) {
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
  const dayTimes = day ? [...(byDay.get(day) ?? [])].sort() : [];
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
    <div className="stack" style={{ maxWidth: 1400 }}>
      {mine.length ? (
        <section className="card-s" aria-label="Your booked call">
          {mine.map((m) => {
            const p = m.person ? people[m.person] : undefined;
            const name = p?.name ?? who;
            return (
              <div key={m.id} className="bk-booked">
                <Avatar url={p?.avatar_url ?? null} initials={name.charAt(0).toUpperCase()} size={72} />
                <div className="bk-booked-body">
                  <h2 className="qh" style={{ margin: 0 }} translate="no">{`Congrats! Your call with ${name} is booked for ${full(m.starts_at)}.`}</h2>
                  {p?.bio ? <p style={{ margin: "8px 0 0" }}><strong>{`A little about ${name.split(" ")[0]}: `}</strong><span translate="no">{p.bio}</span></p> : null}
                  <p style={{ margin: "10px 0 0" }} translate="no" lang={p?.language ? undefined : "en"}>{expectText(p?.language, { minutes, name: name.split(" ")[0], time: new Date(m.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) })}</p>
                  <div className="rs-actions" style={{ margin: "12px 0 0" }}>
                    <RoomLink id={m.id} startsAt={m.starts_at} nowIso={nowIso} minutes={minutes} auto />
                    {new Date(m.starts_at).getTime() > new Date(nowIso).getTime() ? <button type="button" className="btn small" disabled={pending} onClick={() => { const soon = new Date(m.starts_at).getTime() - new Date(nowIso).getTime() < 24 * 3600_000; if (soon && !window.confirm(`This call is less than 24 hours away. If you cancel now, it will not be rebooked. Cancel anyway?`)) return; start(async () => { await cancelBooking(m.id); router.refresh(); }); }}>Cancel this call</button> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
      {mine.length ? <CallFrame startsAt={mine[0].starts_at} nowIso={nowIso} name={people[mine[0].person ?? ""]?.name ?? who} /> : null}
      {!mine.length ? <section className="card-s" aria-label="Pick a time">
        <h2 className="qh" style={{ marginTop: 0 }}>Pick a time</h2>
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
                  <div className="bk-col">{dayTimes.map((iso) => (
                    <div key={iso} className="bk-slotwrap">
                      <button type="button" className="bk-slot" aria-pressed={pick === iso} onClick={() => setPick(pick === iso ? null : iso)} translate="no">{time(iso)}</button>
                      {pick === iso ? (
                        <div className="bk-confirm" role="group" aria-label="Confirm this time">
                          <strong>Book this time?</strong>
                          <span className="when" translate="no">{full(iso)}</span>
                          <div className="bk-confirm-btns">
                            <button type="button" className="btn primary small" disabled={pending} onClick={confirm}>{pending ? "Booking…" : "Book my call"}</button>
                            <button type="button" className="btn small" onClick={() => setPick(null)}>Not now</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  </div>
                </>
              ) : <p className="when" style={{ margin: 0 }}>Choose a day to see the free times.</p>}
            </div>
          </div>
        )}
        {error ? <p className="err" role="alert">{error}</p> : null}
      </section> : null}
    </div>
  );
}

/** Where the video will appear: the page looks like it will at the time of the call. When the time comes, the call opens here for them. */
function CallFrame({ startsAt, nowIso, name }: { startsAt: string; nowIso: string; name: string }) {
  const [now, setNow] = useState(() => new Date(nowIso).getTime());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const mins = Math.max(0, Math.round((new Date(startsAt).getTime() - now) / 60_000));
  const left = mins >= 2880 ? `${Math.floor(mins / 1440)} days` : mins >= 120 ? `${Math.floor(mins / 60)} hours` : mins > 1 ? `${mins} minutes` : mins === 1 ? "1 minute" : "now";
  return (
    <section className="bk-frame" aria-label="Your video call">
      <div className="bk-frame-inner">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="M15.5 10.5l6-3.5v10l-6-3.5" /></svg>
        <p className="bk-frame-t" translate="no">{mins > 15 ? `Your video call with ${name.split(" ")[0]} will appear here` : mins > 0 ? `Your call with ${name.split(" ")[0]} is about to begin` : `Your call with ${name.split(" ")[0]} is starting`}</p>
        <p className="when" style={{ margin: 0 }} translate="no">{mins > 0 ? `Starts in ${left}. Keep this tab open.` : "Opening your call…"}</p>
      </div>
    </section>
  );
}
