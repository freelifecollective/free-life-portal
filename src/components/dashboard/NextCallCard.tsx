import Link from "next/link";
import { LiveBadge } from "@/components/LiveBadge";
import { Attendees } from "@/components/calendar/Attendees";
import { LocalTime } from "@/components/calendar/LocalTime";
import { RsvpControls } from "@/components/calendar/RsvpControls";
import { SpeakerBubbles } from "@/components/calendar/SpeakerBubbles";
import { JoinButton } from "@/components/calls/JoinButton";
import { Countdown } from "@/components/dashboard/Countdown";
import { CopyInvite } from "@/components/dashboard/CopyInvite";
import { NEXT_LABEL, speakersOf, type Call, type RsvpSummary } from "@/lib/calls/types";
import { callLength } from "@/lib/calls/length";
import { endsAt, formatInZone } from "@/lib/time";

/** The "Next Community Call" card, the same on Home and on the Calls screen: name, time, speakers, countdown, and the two RSVP choices. */
export function NextCallCard({ call, summary, now, inviteUsername }: { call: Call | null; summary: RsvpSummary | null; now: number; inviteUsername?: string | null }) {
  if (!call) {
    return (
      <section className="home-call" aria-label="Next call">
        <div className="hc-top"><span className="hc-label">Next Call</span></div>
        <p className="hc-title" style={{ fontSize: 22 }}>No calls are scheduled yet. <Link href="/calendar" style={{ color: "inherit" }}>Open the calendar</Link></p>
      </section>
    );
  }
  const start = new Date(call.starts_at);
  const end = endsAt(start, call.duration_minutes);
  const live = now >= start.getTime() && now < end.getTime();
  const over = now >= end.getTime();
  return (
    <section className={"home-call" + (live ? " live" : "")} aria-label={NEXT_LABEL[call.kind]}>
      <div className="hc-top">
        <span className="hc-label">{NEXT_LABEL[call.kind]}</span>
        {live ? <LiveBadge>LIVE</LiveBadge> : call.audience === "leads_open" ? <span className="hc-open"><span className="hc-dot" />Registration open</span> : null}
      </div>
      <h2 className="hc-title">{call.title}</h2>
      <p className="hc-meta">{formatInZone(start)} · {callLength(call)}</p>
      <SpeakerBubbles speakers={speakersOf(call)} />
      <LocalTime iso={call.starts_at} />
      <Countdown startsAt={call.starts_at} endsAt={end.toISOString()} />
      <div className="hc-rsvp">
        <RsvpControls callId={call.id} mine={summary?.mine ?? null} liveLabel="I'll be there LIVE" liveOn="You're coming LIVE" replayLabel="I'll catch the replay" replayOn="You'll catch the replay" />
      </div>
      {(call.join_url && !over) || (inviteUsername && call.audience === "leads_open") ? (
        <div className="hc-actions">
          {call.join_url && !over ? <JoinButton callId={call.id} startsAt={call.starts_at} durationMinutes={call.duration_minutes} /> : null}
          {inviteUsername && call.audience === "leads_open" ? <CopyInvite username={inviteUsername} className="dc-btn" /> : null}
        </div>
      ) : null}
      {call.join_url && !over ? <p className="hc-note">The waiting room opens 10 minutes before the call starts.</p> : null}
      {summary ? <div className="hc-people"><Attendees summary={summary} /></div> : null}
    </section>
  );
}
