"use client";

import { useRouter } from "next/navigation";

/** Pick a topic and/or a year to show only those recordings. Topics are A to Z; only topics and years that have a recording you can see are listed. */
export function TopicFilter({ topics, years, topic, year }: { topics: string[]; years: number[]; topic: string | null; year: number | null }) {
  const router = useRouter();
  if (topics.length === 0 && years.length === 0) return null;
  const go = (t: string | null, y: number | null) => {
    const q = new URLSearchParams();
    if (t) q.set("topic", t);
    if (y) q.set("year", String(y));
    router.push(q.size ? `/calls?${q}` : "/calls");
  };
  return (
    <div className="rec-filters">
      {topics.length ? (
        <div className="field topic-filter">
          <label htmlFor="topic-filter">Topic</label>
          <select id="topic-filter" value={topic ?? ""} onChange={(e) => go(e.target.value || null, year)}>
            <option value="">All topics</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      ) : null}
      {years.length ? (
        <div className="field topic-filter year-filter">
          <label htmlFor="year-filter">Year</label>
          <select id="year-filter" value={year ?? ""} onChange={(e) => go(topic, e.target.value ? Number(e.target.value) : null)}>
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}
