"use client";

import { useRouter } from "next/navigation";

/** Pick a topic to show only those recordings. Topics are A to Z, and only topics that have a recording you can see are listed. */
export function TopicFilter({ topics, current }: { topics: string[]; current: string | null }) {
  const router = useRouter();
  if (topics.length === 0) return null;
  return (
    <div className="field topic-filter">
      <label htmlFor="topic-filter">Sort by topic</label>
      <select id="topic-filter" value={current ?? ""} onChange={(e) => router.push(e.target.value ? `/calls?topic=${encodeURIComponent(e.target.value)}` : "/calls")}>
        <option value="">All topics</option>
        {topics.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}
