import type { BadgeState } from "@/lib/badges/defs";

const NAMES = { followup: "follow-up", morning: "morning routine", cleared: "list cleared" } as const;

/** A slim line of the streaks that are running right now. Nothing shows when none are. */
export function StreakLine({ streaks }: { streaks: BadgeState["streaks"] }) {
  const live = (Object.keys(NAMES) as (keyof typeof NAMES)[]).filter((k) => streaks[k].current > 0);
  if (live.length === 0) return null;
  return (
    <p className="streak-line">
      {live.map((k) => <span key={k}><span aria-hidden="true">🔥</span> {streaks[k].current}-day {NAMES[k]} streak</span>)}
    </p>
  );
}
