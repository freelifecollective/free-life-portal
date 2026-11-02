import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { listUpcomingCalls, rsvpSummary } from "@/lib/calls/queries";
import { NextCallCard } from "@/components/dashboard/NextCallCard";
import { formatInZone, nowMs } from "@/lib/time";
import { formatTime } from "@/lib/recordings/vimeo";
import { listRecordings } from "@/lib/recordings/queries";
import { TOPICS } from "@/lib/recordings/topics";
import { TopicFilter } from "@/components/calls/TopicFilter";

export const instant = false;
export const metadata = { title: "Calls" };

export default async function CallsPage(props: PageProps<"/calls">) {
  const sp = await props.searchParams;
  const topicParam = Array.isArray(sp.topic) ? sp.topic[0] : sp.topic;
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Calls</PageHeading><p className="page-lede">This needs the database.</p></>;
  const now = nowMs();
  const [upcoming, all] = await Promise.all([listUpcomingCalls(supabase, now), listRecordings(supabase)]);
  const published = all.filter((r) => r.published);
  const yearOf = (iso: string) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date(iso)));
  const yearParam = Number(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const present = TOPICS.filter((t) => published.some((r) => r.topics.includes(t)));
  const topic = present.find((t) => t === topicParam) ?? null;
  const inTopic = topic ? published.filter((r) => r.topics.includes(topic)) : published;
  /* only years that have a recording in the chosen topic are offered, newest first */
  const years = [...new Set(inTopic.map((r) => yearOf(r.recorded_at)))].sort((a, b) => b - a);
  const year = years.includes(yearParam) ? yearParam : null;
  const recordings = year ? inTopic.filter((r) => yearOf(r.recorded_at) === year) : inTopic;
  /* grouped by year, newest first, so a long list reads as chapters instead of one wall of cards */
  const byYear = [...new Set(recordings.map((r) => yearOf(r.recorded_at)))].sort((a, b) => b - a).map((y) => [y, recordings.filter((r) => yearOf(r.recorded_at) === y)] as const);
  const next = upcoming[0];
  const summary = next ? await rsvpSummary(supabase, next.id, 50) : null;

  return (
    <>
      <PageHeading lede="Join calls live, or watch the recordings any time.">Calls</PageHeading>
      <div className="settings" style={{ maxWidth: 1100 }}>
        {/* the same card, at the same width, as on Home */}
        <div className="home-row next-only">
          <NextCallCard call={next ?? null} summary={summary} now={now} inviteUsername={session.profile.role === "lead" ? null : session.profile.username} />
        </div>

        <section className="rv" aria-label="Recordings">
          <div className="rv-head">
            <div>
              <h2 className="qh" style={{ margin: 0 }}>{topic ?? "All"} Recordings{year ? ` · ${year}` : ""}</h2>
              <p className="when" style={{ margin: "2px 0 0" }}>{`${recordings.length} ${recordings.length === 1 ? "recording" : "recordings"}`}</p>
            </div>
            <TopicFilter topics={[]} years={years} topic={topic} year={year} />
          </div>
          {present.length ? (
            <nav className="rv-chips" aria-label="Topics">
              <Link className={"rv-chip" + (!topic ? " on" : "")} href={year ? `/calls?year=${year}` : "/calls"}>All</Link>
              {present.map((t) => <Link key={t} className={"rv-chip" + (topic === t ? " on" : "")} href={`/calls?topic=${encodeURIComponent(t)}${year ? `&year=${year}` : ""}`}>{t}</Link>)}
            </nav>
          ) : null}
          {recordings.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>{session.profile.role === "lead" ? "Recordings open to leads will appear here." : "No recordings yet. They are added after each call."}</p></section> : (
            byYear.map(([y, list]) => (
              <div key={y} className="rv-year">
                {byYear.length > 1 ? <h3 className="rv-year-h">{y}</h3> : null}
                <ul className="rv-grid">
                  {list.map((r) => (
                    <li key={r.id} className="rv-card">
                      <Link href={`/calls/${r.id}`} className="rv-link">
                        <span className="rv-thumb">
                          {r.thumb_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.thumb_url} alt="" loading="lazy" />
                          ) : <span className="rv-fallback" aria-hidden="true">▶</span>}
                          {r.duration_secs ? <span className="rv-dur">{formatTime(r.duration_secs)}</span> : null}
                        </span>
                        <span className="rv-body">
                          <span className="rv-title">{r.title}</span>
                          <span className="rv-meta">{formatInZone(new Date(r.recorded_at)).split(",").slice(0, 2).join(",")}</span>
                          {r.topics.length ? <span className="rv-tags">{r.topics.slice(0, 2).map((t) => <span key={t} className="rv-tag">{t}</span>)}{r.topics.length > 2 ? <span className="rv-tag more">{`+${r.topics.length - 2}`}</span> : null}</span> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}
