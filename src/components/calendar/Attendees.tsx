import { Avatar } from "@/components/Avatar";
import type { RsvpSummary } from "@/lib/calls/types";

const SHOWN = 8;

/** A row of picture bubbles plus counts. Works the same for 5 people or 500: only the first few are drawn. */
export function Attendees({ summary }: { summary: RsvpSummary }) {
  const total = summary.live + summary.recording;
  if (total === 0) return <p className="attendees-empty">Be the first to RSVP.</p>;
  const shown = summary.people.slice(0, SHOWN);
  const more = total - shown.length;
  return (
    <div className="attendees">
      <ul className="bubbles" aria-label="People who have RSVPed">
        {shown.map((p, i) => (
          <li key={(p.username ?? "") + i} title={p.name}>
            <Avatar url={p.avatar_url} initials={(p.name || "?").charAt(0).toUpperCase()} size={36} label={p.name} />
          </li>
        ))}
        {more > 0 ? <li className="bubble-more" aria-label={`and ${more} more`}>+{more}</li> : null}
      </ul>
      <p className="attendee-count">
        {summary.live} coming live{summary.recording ? `, ${summary.recording} watching the recording` : ""}
      </p>
    </div>
  );
}
