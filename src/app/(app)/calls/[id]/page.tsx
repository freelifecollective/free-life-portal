import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { RecordingPlayer } from "@/components/calls/RecordingPlayer";
import { SeeFeedback } from "@/components/calls/SeeFeedback";
import { requireMember } from "@/lib/auth/guards";
import { getRecording } from "@/lib/recordings/queries";
import { formatInZone } from "@/lib/time";

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
      <PageHeading lede={formatInZone(new Date(rec.recorded_at))}>{rec.title}</PageHeading>
      <div style={{ maxWidth: 900 }}>
        <RecordingPlayer recordingId={rec.id} vimeoId={rec.vimeo_id} hash={rec.vimeo_hash} start={rec.start_secs} end={rec.end_secs} title={rec.title} />
        {rec.topics.length ? <p className="tags-row">{rec.topics.map((t) => <Link key={t} className="doc-tag" href={`/calls?topic=${encodeURIComponent(t)}`} style={{ textDecoration: "none", color: "inherit" }}>{t}</Link>)}</p> : null}
        {rec.description ? <p className="post-body" style={{ marginTop: 16 }}>{rec.description}</p> : null}
        {rec.call_id ? <p style={{ marginTop: 16 }}><SeeFeedback callId={rec.call_id} /></p> : null}
        {!rec.published ? <p className="err">Draft: only admins can see this.</p> : null}
      </div>
    </>
  );
}
