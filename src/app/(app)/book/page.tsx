import Link from "next/link";
import { BookingPicker, type Mine } from "@/components/booking/BookingPicker";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { dropBusy } from "@/lib/google/busy";
import { busyIntervals } from "@/lib/google/calendar";

export const instant = false;
export const metadata = { title: "Book a Call" };

type Info = { coach_id: string; coach_name: string | null; target_id: string; target_name: string | null; with_closer: boolean; call_minutes: number; tz: string; has_hours: boolean };

export default async function BookPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Book a Call</PageHeading><p className="page-lede">This needs the database.</p></>;
  const isLead = session.profile.role === "lead";
  const [{ data: infoRows }, { data: slots }, { data: mine }] = await Promise.all([
    supabase.rpc("booking_info"),
    supabase.rpc("open_slots", { p_days: 14 }),
    supabase.from("booked_calls").select("id, starts_at").eq("lead_id", session.user.id).gt("starts_at", new Date().toISOString()).order("starts_at"),
  ]);
  const info = ((infoRows ?? []) as Info[])[0];
  let times = ((slots ?? []) as { slot: string }[]).map((x) => x.slot);
  /* anything already in the closer's (or coach's) Google Calendar is taken off */
  if (info && times.length) {
    const busy = await busyIntervals(info.target_id, times[0], new Date(new Date(times[times.length - 1]).getTime() + info.call_minutes * 60_000).toISOString());
    if (busy) times = dropBusy(times, busy, info.call_minutes);
  }
  return (
    <>
      <PageHeading lede="Pick a free time for your coaching call.">Book a Call</PageHeading>
      {!isLead ? (
        <section className="card-s" style={{ maxWidth: 640 }}>
          <p style={{ margin: "0 0 12px" }}>This is where the leads you bring in book a coaching call with you. Set when you are open, and they pick a free time.</p>
          <Link className="btn small primary" href="/settings/availability" style={{ textDecoration: "none" }}>Set my availability</Link>
        </section>
      ) : !info ? (
        <section className="card-s" style={{ maxWidth: 640 }}><p style={{ margin: 0 }}>You can book a call once someone from the community has invited you. Ask whoever sent you here for their link.</p></section>
      ) : !info.has_hours ? (
        <section className="card-s" style={{ maxWidth: 640 }}><p style={{ margin: 0 }}>{`${info.target_name ?? info.coach_name ?? "Your coach"} has not set open hours yet. Message them and ask for a time.`}</p></section>
      ) : (
        <BookingPicker slots={times} mine={(mine ?? []) as Mine[]} who={info.target_name ?? info.coach_name ?? "your coach"} minutes={info.call_minutes} withCloser={info.with_closer} />
      )}
    </>
  );
}
