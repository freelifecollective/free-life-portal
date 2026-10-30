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
  const next = upcoming[0];
  const summary = next ? await rsvpSummary(supabase, next.id, 50) : null;

  return (
    <>
      <PageHeading lede="Join calls live, or watch the recordings any time.">Calls</PageHeading>
      <div className="settings" style={{ maxWidth: 900 }}>
        {/* the same card, at the same width, as on Home */}
        <div className="home-row next-only">
          <NextCallCard call={next ?? null} summary={summary} now={now} inviteUsername={session.profile.role === "lead" ? null : session.profile.username} />
        </div>

        <div className="rec-head"><h2 className="qh" style={{ margin: 0 }}>{topic ?? "All"} Recordings{year ? ` · ${year}` : ""}</h2><TopicFilter topics={[...present]} years={years} topic={topic} year={year} /></div>
        {recordings.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>{session.profile.role === "lead" ? "Recordings open to leads will appear here." : "No recordings yet. They are added after each call."}</p></section> : (
          <ul className="doc-grid rec-grid">
            {recordings.map((r) => (
              <li key={r.id} className="doc-card">
                <Link href={`/calls/${r.id}`} className="doc-card-main">
                  {r.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="doc-cover" src={r.thumb_url} alt="" loading="lazy" />
                  ) : <span className="doc-cover folder" aria-hidden="true">🎬</span>}
                  <span className="doc-card-name">{r.title}</span>
                  <span className="doc-tags"><span className="when">{formatInZone(new Date(r.recorded_at)).split(",").slice(0, 2).join(",")}{r.duration_secs ? ` · ${formatTime(r.duration_secs)}` : ""}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
