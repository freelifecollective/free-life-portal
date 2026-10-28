import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { CallCard } from "@/components/calendar/CallCard";
import { requireMember } from "@/lib/auth/guards";
import { listUpcomingCalls, pickFeatured, rsvpSummary } from "@/lib/calls/queries";
import { formatDayInZone, nowMs } from "@/lib/time";

export const instant = false; // depends on who is signed in
export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) {
    return (
      <>
        <PageHeading>Calendar</PageHeading>
        <p className="page-lede">The calendar needs the database, which preview mode does not have.</p>
      </>
    );
  }
  const now = nowMs();
  const calls = await listUpcomingCalls(supabase, now);
  const summaries = await Promise.all(calls.map((c) => rsvpSummary(supabase, c.id)));
  const byId = new Map(calls.map((c, i) => [c.id, summaries[i]]));
  const featured = pickFeatured(calls);
  const rest = calls.filter((c) => c !== featured);

  /* group the rest by day (Eastern) */
  const days: { label: string; items: typeof calls }[] = [];
  for (const c of rest) {
    const label = formatDayInZone(new Date(c.starts_at));
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(c); else days.push({ label, items: [c] });
  }

  return (
    <>
      <PageHeading lede="All times are Eastern. If you are somewhere else, your own time shows underneath.">Calendar</PageHeading>
      {session.profile.role === "admin" ? <p><Link className="linkbtn" href="/admin/calls" style={{ padding: 0 }}>Manage calls</Link></p> : null}
      {!featured ? (
        <section className="card-s" style={{ maxWidth: 560 }}>
          <p style={{ margin: 0 }}>No calls are scheduled yet. When one is added, it will appear here.</p>
        </section>
      ) : (
        <div className="calendar">
          <CallCard call={featured} summary={byId.get(featured.id)!} featured now={now} />
          {days.length ? <h2 className="qh" style={{ marginTop: 36 }}>Coming up</h2> : null}
          {days.map((d) => (
            <section key={d.label} aria-label={d.label}>
              <h3 className="day-label">{d.label}</h3>
              {d.items.map((c) => <CallCard key={c.id} call={c} summary={byId.get(c.id)!} now={now} />)}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
