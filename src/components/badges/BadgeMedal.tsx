import { parseKey, tierOf } from "@/lib/badges/defs";

/** Tier colours, from soft tan up to a glowing gold-and-dark "legend" medal: [ring light, ring dark, icon]. */
const TIERS: [string, string, string][] = [
  ["#EBD6C6", "#B79A86", "#8C6F5E"],
  ["#EFEBE6", "#ABA39B", "#6E665F"],
  ["#F6E3AE", "#C9A24B", "#8D6A1E"],
  ["#F6D9CC", "#C98B77", "#9A5A47"],
  ["#8C6F5E", "#3A2F29", "#6E5547"],
  ["#FFF3C9", "#D4A838", "#2B2522"],
];

const ICONS: Record<string, string[]> = {
  followup: ["M22 2 11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  morning: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
  cleared: ["M20 6 9 17l-5-5", "M19 1v4M17 3h4"],
  community: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  masterclass: ["M22 10 12 5 2 10l10 5 10-5z", "M6 12v5c3 3 9 3 12 0v-5", "M22 10v6"],
  answers: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M8 9h8M8 13h5"],
  coaching: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"],
  sales: ["M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z", "M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"],
};

/** One pretty badge: a round medal with a ring, an icon and a number on a ribbon. Greyed out until it is earned. */
export function BadgeMedal({ id, size = 96, earned = true, compact = false }: { id: string; size?: number; earned?: boolean; compact?: boolean }) {
  const parsed = parseKey(id);
  if (!parsed) return null;
  const { def, n } = parsed;
  const [light, dark, ink] = earned ? TIERS[tierOf(def, n)] : ["#ECE8E3", "#CFC8C0", "#B5ADA4"];
  const gid = `bm-${id}-${earned ? "on" : "off"}`;
  const legend = earned && tierOf(def, n) >= 4;
  return (
    <svg className={"medal" + (earned ? "" : " locked")} width={size} height={size * (compact ? 1.06 : 1.12)} viewBox={compact ? "0 0 100 106" : "0 0 100 112"} role="img" aria-label={`${def.title}: ${def.label(n)}${earned ? "" : " (not earned yet)"}`}>
      <defs>
        <linearGradient id={`${gid}-r`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={light} /><stop offset="1" stopColor={dark} /></linearGradient>
        <radialGradient id={`${gid}-f`} cx="0.35" cy="0.3" r="0.9"><stop offset="0" stopColor={legend ? "#4a3d35" : "#FFFFFF"} /><stop offset="1" stopColor={legend ? "#2B2522" : "#F3EEE8"} /></radialGradient>
      </defs>
      <circle cx="50" cy="48" r="46" fill={`url(#${gid}-r)`} />
      <circle cx="50" cy="48" r="39" fill={`url(#${gid}-f)`} stroke={dark} strokeOpacity={0.35} strokeWidth="1" />
      {legend ? <circle cx="50" cy="48" r="43" fill="none" stroke={light} strokeOpacity={0.8} strokeWidth="0.8" strokeDasharray="1.5 3" /> : null}
      <g transform="translate(30 25) scale(1.67)" fill="none" stroke={legend ? light : ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[def.icon].map((d) => <path key={d} d={d} />)}
      </g>
      {compact ? (
        <>
          <rect x="26" y="78" width="48" height="26" rx="13" fill={`url(#${gid}-r)`} stroke="#fff" strokeWidth="3" />
          <text x="50" y="97" textAnchor="middle" fontFamily="var(--font-label), sans-serif" fontWeight="800" fontSize={String(n).length > 3 ? 17 : 21} fill={earned ? (tierOf(def, n) === 4 ? "#fff" : "#2B2522") : "#8E867D"}>{n}</text>
        </>
      ) : (
        <>
          <path d="M22 84h56l-6 12 6 12H22l6-12z" fill={`url(#${gid}-r)`} />
          <text x="50" y="102" textAnchor="middle" fontFamily="var(--font-label), sans-serif" fontWeight="800" fontSize="15" fill={earned ? (tierOf(def, n) === 4 ? "#fff" : "#2B2522") : "#8E867D"}>{n}</text>
        </>
      )}
    </svg>
  );
}

export function labelFor(id: string): { title: string; level: string } | null {
  const p = parseKey(id);
  return p ? { title: p.def.title, level: p.def.label(p.n) } : null;
}
