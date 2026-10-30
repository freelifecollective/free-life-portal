import Link from "next/link";
import { AUDIENCE_LABEL, KIND_LABEL, speakersOf, type Call, type RsvpMode, type RsvpSummary } from "@/lib/calls/types";
import { endsAt, formatInZone } from "@/lib/time";
import { LiveBadge } from "@/components/LiveBadge";
import { FeedbackLink } from "@/components/calls/FeedbackLink";
import { JoinButton } from "@/components/calls/JoinButton";
import { callLength } from "@/lib/calls/length";
import { Attendees } from "./Attendees";
import { SpeakerBubbles } from "./SpeakerBubbles";
import { LocalTime } from "./LocalTime";
import { RsvpControls } from "./RsvpControls";

/** What happened for this person on a call that is over. */
export type Review = { attended: boolean; mode: RsvpMode | null; recordingId: string | null; watched: boolean; canFeedback?: boolean; gaveFeedback?: boolean };

function ReviewBlock({ review, call }: { review: Review; call: Pick<Call, "id" | "title"> }) {
  const status = review.attended
    ? review.watched ? "✓ You attended live and watched the replay" : "✓ You attended live"
    : review.watched ? "✓ You watched the replay"
    : review.mode === "recording" ? "You're going to catch the replay"
    : review.mode === "live" ? "You planned to join live. You can still catch the replay."
    : "You did not RSVP to this call.";
  return (
    <div className="call-review">
      <p className="call-status">{status}</p>
      {review.recordingId
        ? <Link className="btn primary" href={`/calls/${review.recordingId}`} style={{ textDecoration: "none" }}>{review.watched ? "Watch the replay again" : "Watch the replay"}</Link>
        : <p className="when" style={{ margin: 0 }}>The replay is not up yet. We will let you know when it is.</p>}
      {review.canFeedback ? (review.gaveFeedback ? <p className="when" style={{ margin: 0 }}>✓ Thanks for sharing your feedback</p> : <FeedbackLink callId={call.id} title={call.title} />) : null}
    </div>
  );
}

/** A call with its time, who it is for, the RSVP buttons and who is coming. Once it is over, it shows what you did and a button to the replay. */
export function CallCard({ call, summary, featured = false, now, review, attendance }: { call: Call; summary: RsvpSummary; featured?: boolean; now: number; review?: Review; attendance?: RsvpSummary }) {
  const start = new Date(call.starts_at);
  const live = now >= start.getTime() && now < endsAt(start, call.duration_minutes).getTime();
  const notOver = now < endsAt(start, call.duration_minutes).getTime();
  return (
    <article className={"call-card" + (featured ? " featured" : "")} aria-labelledby={`call-${call.id}`}>
      <div className="call-tags">
        {featured ? <span className="tag tag-pin">Next call</span> : null}
        <span className="tag">{KIND_LABEL[call.kind]}</span>
        <span className={"tag" + (call.audience === "affiliates_only" ? " tag-dark" : "")}>{AUDIENCE_LABEL[call.audience]}</span>
        {live ? <LiveBadge>LIVE · Happening now</LiveBadge> : null}
      </div>
      <h2 id={`call-${call.id}`} className="call-title">{call.title}</h2>
      <p className="call-time">
        {formatInZone(start)} · {callLength(call)}
        <LocalTime iso={call.starts_at} />
      </p>
      <SpeakerBubbles speakers={speakersOf(call)} profiles />
      {call.description ? <p className="call-desc">{call.description}</p> : null}
      {notOver && call.join_url ? <p><JoinButton callId={call.id} startsAt={call.starts_at} durationMinutes={call.duration_minutes} /></p> : null}
      {!notOver && attendance ? <Attendees summary={attendance} past /> : null}
      {!notOver && review ? <ReviewBlock review={review} call={call} /> : notOver ? <RsvpControls callId={call.id} mine={summary.mine} /> : null}
      {notOver || !review ? <Attendees summary={summary} /> : null}
    </article>
  );
}
