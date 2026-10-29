import { AUDIENCE_LABEL, KIND_LABEL, type Call, type RsvpSummary } from "@/lib/calls/types";
import { endsAt, formatInZone } from "@/lib/time";
import { JoinButton } from "@/components/calls/JoinButton";
import { Attendees } from "./Attendees";
import { LocalTime } from "./LocalTime";
import { RsvpControls } from "./RsvpControls";

/** A call with its time, who it is for, the RSVP buttons and who is coming. */
export function CallCard({ call, summary, featured = false, now }: { call: Call; summary: RsvpSummary; featured?: boolean; now: number }) {
  const start = new Date(call.starts_at);
  const live = now >= start.getTime() && now < endsAt(start, call.duration_minutes).getTime();
  const soon = now >= start.getTime() - 30 * 60_000 && now < endsAt(start, call.duration_minutes).getTime();
  return (
    <article className={"call-card" + (featured ? " featured" : "")} aria-labelledby={`call-${call.id}`}>
      <div className="call-tags">
        {featured ? <span className="tag tag-pin">Next call</span> : null}
        <span className="tag">{KIND_LABEL[call.kind]}</span>
        <span className={"tag" + (call.audience === "affiliates_only" ? " tag-dark" : "")}>{AUDIENCE_LABEL[call.audience]}</span>
        {live ? <span className="tag tag-live">Happening now</span> : null}
      </div>
      <h2 id={`call-${call.id}`} className="call-title">{call.title}</h2>
      <p className="call-time">
        {formatInZone(start)} · {call.duration_minutes} min
        <LocalTime iso={call.starts_at} />
      </p>
      {call.description ? <p className="call-desc">{call.description}</p> : null}
      {soon && call.join_url ? <p><JoinButton callId={call.id} /></p> : null}
      <RsvpControls callId={call.id} mine={summary.mine} />
      <Attendees summary={summary} />
    </article>
  );
}
