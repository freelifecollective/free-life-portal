import { UserText } from "@/components/UserText";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { RecordingPlayer } from "@/components/calls/RecordingPlayer";
import { SeeFeedback } from "@/components/calls/SeeFeedback";
import { requireMember } from "@/lib/auth/guards";
import { getRecording } from "@/lib/recordings/queries";
import { formatDateInZone } from "@/lib/time";

export const instant = false;

export default async function RecordingPage(props: PageProps<"/calls/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireMember();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const rec = await getRecording(supabase, id);
  if (!rec) notFound();
  return (
    <>
      <p style={{ margin: "0 0 8px" }}><Link className="doc-back" href="/calls">← Back to Calls</Link></p>
      <PageHeading lede={formatDateInZone(new Date(rec.recorded_at))}><UserText text={rec.title} /></PageHeading>
      <div className="rv-detail">
        <RecordingPlayer recordingId={rec.id} vimeoId={rec.vimeo_id} hash={rec.vimeo_hash} start={rec.start_secs} end={rec.end_secs} title={rec.title} />
        {rec.topics.length || rec.description || rec.call_id ? (
          <section className="card-s" style={{ display: "grid", gap: 14 }}>
            {rec.topics.length ? <p className="tags-row" style={{ margin: 0 }}>{rec.topics.map((t) => <Link key={t} className="rv-tag" href={`/calls?topic=${encodeURIComponent(t)}`} style={{ textDecoration: "none" }}>{t}</Link>)}</p> : null}
            {rec.description ? <p className="post-body" style={{ margin: 0 }}>{rec.description}</p> : null}
            {rec.call_id ? <p style={{ margin: 0 }}><SeeFeedback callId={rec.call_id} /></p> : null}
          </section>
        ) : null}
        {!rec.published ? <p className="err">Draft: only admins can see this.</p> : null}
      </div>
    </>
  );
}
