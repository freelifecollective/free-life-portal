import Link from "next/link";
import { BadgeMedal } from "./BadgeMedal";
import { FAMILIES, nextStep, progressOf, type BadgeState } from "@/lib/badges/defs";

/** The full tracker: streaks with progress to the next badge, then every badge, earned ones in colour. */
export function BadgesPanel({ state }: { state: BadgeState }) {
  const earned = new Set(state.earned.map((e) => e.key));
  return (
    <section className="badges" aria-label="Streaks and badges">
      <h2 className="qh tasks-h">Streaks &amp; badges</h2>
      <div className="streak-grid">
        {FAMILIES.filter((f) => f.unit === "days").map((f) => {
          const p = progressOf(f, state);
          const cur = p.current ?? 0;
          const next = nextStep(f, cur);
          return (
            <div key={f.id} className="streak-card">
              <span className="streak-name">{f.title}</span>
              <span className="streak-n"><span aria-hidden="true">{cur > 0 ? "🔥" : "✨"}</span> {cur}<small>{cur === 1 ? " day" : " days"}</small></span>
              <span className="when">{cur > 0 ? "in a row right now" : p.value > 0 ? "Start a new streak today" : "Start your first streak today"} · best {p.value}</span>
              {next ? (
                <>
                  <span className="tasks-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (cur / next) * 100)}%` }} /></span>
                  <span className="when">{next - cur} more {next - cur === 1 ? "day" : "days"} to {f.label(next).replace(" in a row", "")} badge</span>
                </>
              ) : <span className="when">Every badge earned. Legend!</span>}
            </div>
          );
        })}
      </div>

      {FAMILIES.map((f) => {
        const value = progressOf(f, state).value;
        return (
          <div key={f.id} className="shelf">
            <div className="shelf-head"><strong>{f.title}</strong><span className="when">{f.blurb}</span></div>
            <ul className="shelf-row">
              {f.steps.map((n) => {
                const key = `${f.id}_${n}`;
                const on = earned.has(key);
                return (
                  <li key={key} className={on ? "on" : ""}>
                    <BadgeMedal id={key} size={84} earned={on} />
                    <span className="shelf-label">{f.label(n)}</span>
                    {!on && f.unit === "calls" ? <span className="when">{value} so far</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="when" style={{ margin: 0 }}>Calls count when you press <strong>Join LIVE now!</strong> in the portal. <Link href="/calls">Go to Calls</Link></p>
    </section>
  );
}
