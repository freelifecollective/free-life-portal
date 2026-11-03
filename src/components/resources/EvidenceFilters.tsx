"use client";

import { useRouter } from "next/navigation";
import { RANKS, STORY_TYPES } from "@/lib/resources/kinds";

/** Pick a rank and/or a kind of story to show. */
export function EvidenceFilters({ rank, story }: { rank: string; story: string }) {
  const router = useRouter();
  const go = (r: string, s: string) => {
    const q = new URLSearchParams();
    if (r) q.set("rank", r);
    if (s) q.set("story", s);
    router.push(`/advertising/evidence-manual${q.size ? `?${q}` : ""}`);
  };
  return (
    <div className="ev-filters">
      <div className="field"><label htmlFor="ev-rank">Rank</label>
        <select id="ev-rank" value={rank} onChange={(e) => go(e.target.value, story)}>
          <option value="">All ranks</option>{RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select></div>
      <div className="field"><label htmlFor="ev-story">Story</label>
        <select id="ev-story" value={story} onChange={(e) => go(rank, e.target.value)}>
          <option value="">All stories</option>{STORY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></div>
    </div>
  );
}
