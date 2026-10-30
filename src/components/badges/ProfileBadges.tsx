import Link from "next/link";
import { BadgeMedal, labelFor } from "./BadgeMedal";
import { FAMILIES, type BadgeState } from "@/lib/badges/defs";

/** The badges someone has earned, shown on their profile. */
export function ProfileBadges({ state }: { state: BadgeState }) {
  const order = (key: string) => { const [f, n] = key.split("_"); return FAMILIES.findIndex((x) => x.id === f) * 1000 + Number(n); };
  const earned = [...state.earned].sort((a, b) => order(a.key) - order(b.key));
  return (
    <div>
      {earned.length === 0 ? (
        <p style={{ margin: 0 }}>No badges yet. Join a live call or keep a streak going in Tasks, and your first one lands here.</p>
      ) : (
        <ul className="profile-medals">
          {earned.map((e) => { const l = labelFor(e.key); return l ? (
            <li key={e.key} title={`${l.title}: ${l.level}`}><BadgeMedal id={e.key} size={78} /><span>{l.level}</span><small>{l.title}</small></li>
          ) : null; })}
        </ul>
      )}
      <p style={{ margin: "14px 0 0" }}><Link href="/tasks">See all badges and track your streaks →</Link></p>
    </div>
  );
}
