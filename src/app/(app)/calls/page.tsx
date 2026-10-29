import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { JoinButton } from "@/components/calls/JoinButton";
import { requireMember } from "@/lib/auth/guards";
import { LiveBadge } from "@/components/LiveBadge";
import { Attendees } from "@/components/calendar/Attendees";
import { RsvpControls } from "@/components/calendar/RsvpControls";
import { listUpcomingCalls, rsvpSummary } from "@/lib/calls/queries";
import { KIND_LABEL } from "@/lib/calls/types";
import { formatInZone, endsAt, nowMs } from "@/lib/time";
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
  const present = TOPICS.filter((t) => published.some((r) => r.topics.includes(t)));
  const topic = present.find((t) => t === topicParam) ?? null;
  const recordings = topic ? published.filter((r) => r.topics.includes(topic)) : published;
  const next = upcoming[0];
  const live = next && now >= new Date(next.starts_at).getTime() && now < endsAt(new Date(next.starts_at), next.duration_minutes).getTime();
  const summary = next ? await rsvpSummary(supabase, next.id, 50) : null;
  const mine = summary?.mine ?? null;

  return (
    <>
      <PageHeading lede="Join calls live, or watch the recordings any time.">Calls</PageHeading>
      <div className="settings" style={{ maxWidth: 900 }}>
        <section className={"card-s live-card" + (live ? " on" : "")}>
          {next ? (
            <div className="live-grid">
              <div className="live-left">
                <p className="offer-label" style={{ margin: "0 0 6px" }}>{live ? <LiveBadge>LIVE · Happening now</LiveBadge> : "Next call"}</p>
                <h2 className="qh" style={{ margin: "0 0 4px" }}>{next.title}</h2>
                <p className="when" style={{ margin: "0 0 14px" }}>{KIND_LABEL[next.kind]} · {formatInZone(new Date(next.starts_at))} · {next.duration_minutes} min</p>
                <RsvpControls callId={next.id} mine={mine} liveLabel="I'll be there LIVE" liveOn="You're coming LIVE" replayLabel="I'll catch the replay" replayOn="You'll catch the replay" />
                {summary ? <div style={{ marginTop: 14 }}><Attendees summary={summary} /></div> : null}
              </div>
              {next.join_url ? (
                <div className="live-right">
                  <JoinButton callId={next.id} startsAt={next.starts_at} durationMinutes={next.duration_minutes} />
                  <p className="when join-note">The waiting room opens 10 minutes before the call starts.</p>
                </div>
              ) : null}
            </div>
          ) : <p style={{ margin: 0 }}>No calls are scheduled right now. Check the <Link href="/calendar">calendar</Link> for new ones.</p>}
        </section>

        <div className="rec-head"><h2 className="qh" style={{ margin: 0 }}>Recordings</h2><TopicFilter topics={[...present]} current={topic} /></div>
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
