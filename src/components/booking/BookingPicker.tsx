"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookCall, cancelBooking } from "@/app/(app)/book/actions";

export type Mine = { id: string; starts_at: string };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Free times grouped by day, in the time zone of the device you are on. Pick one, confirm, done. */
export function BookingPicker({ slots, mine, who, minutes, withCloser }: { slots: string[]; mine: Mine[]; who: string; minutes: number; withCloser: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const groups = useMemo(() => {
    const m = new Map<string, { label: string; times: string[] }>();
    for (const iso of slots) {
      const d = new Date(iso);
      const k = dayKey(d);
      if (!m.has(k)) m.set(k, { label: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), times: [] });
      m.get(k)!.times.push(iso);
    }
    return [...m.values()];
  }, [slots]);
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
    <div className="stack" style={{ maxWidth: 720 }}>
      {mine.length ? (
        <section className="card-s" aria-label="Your booked call">
          <h2 className="qh" style={{ marginTop: 0 }}>Your booked call</h2>
          {mine.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div><strong translate="no">{full(m.starts_at)}</strong><br /><span className="when">{`With ${who}`}</span></div>
              <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { await cancelBooking(m.id); router.refresh(); })}>Cancel this call</button>
            </div>
          ))}
        </section>
      ) : null}
      <section className="card-s" aria-label="Pick a time">
        <h2 className="qh" style={{ marginTop: 0 }}>{mine.length ? "Need a different time?" : "Pick a time"}</h2>
        <p className="when" style={{ marginTop: 0 }}>{`Calls are ${minutes} minutes with ${who}${withCloser ? ", who is taking calls for your coach" : ""}. Times are shown in your own time zone.`}</p>
        {groups.length === 0 ? <p style={{ margin: 0 }}>There are no free times in the next two weeks. Check back soon.</p> : (
          <div className="bk-days">
            {groups.map((g) => (
              <div key={g.label} className="bk-day">
                <h3 translate="no">{g.label}</h3>
                <div className="bk-slots">{g.times.map((iso) => <button key={iso} type="button" className="bk-slot" aria-pressed={pick === iso} onClick={() => setPick(iso)} translate="no">{time(iso)}</button>)}</div>
              </div>
            ))}
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
