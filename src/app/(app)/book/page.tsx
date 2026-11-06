import Link from "next/link";
import { BookingPicker, type Mine, type Person } from "@/components/booking/BookingPicker";
import { PageHeading } from "@/components/PageHeading";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/auth/guards";
import { dropBusy } from "@/lib/google/busy";
import { busyIntervals } from "@/lib/google/calendar";
import { nowMs } from "@/lib/time";

export const instant = false;
export const metadata = { title: "Book a Call" };

type Info = { coach_id: string; coach_name: string | null; target_id: string; target_name: string | null; with_closer: boolean; call_minutes: number; tz: string; has_hours: boolean };

export default async function BookPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Book a Call</PageHeading><p className="page-lede">This needs the database.</p></>;
  const isLead = session.profile.role === "lead";
  const [{ data: infoRows }, { data: slots }, { data: mine }] = await Promise.all([
    supabase.rpc("booking_info"),
    supabase.rpc("open_slots", { p_days: 60 }),
    supabase.from("booked_calls").select("id, starts_at, member_id, closer_id").eq("lead_id", session.user.id).is("completed_at", null).gt("starts_at", new Date(nowMs() - 3 * 3600_000).toISOString()).order("starts_at"),
  ]);
  const info = ((infoRows ?? []) as Info[])[0];
  let times = ((slots ?? []) as { slot: string }[]).map((x) => x.slot);
  /* anything already in the closer's (or coach's) Google Calendar is taken off */
  if (info && times.length) {
    const busy = await busyIntervals(info.target_id, times[0], new Date(new Date(times[times.length - 1]).getTime() + info.call_minutes * 60_000).toISOString());
    if (busy) times = dropBusy(times, busy, info.call_minutes);
  }
  /* who each booked call is with: their picture, and a short intro when it is a call closer */
  const booked = ((mine ?? []) as { id: string; starts_at: string; member_id: string; closer_id: string | null }[]).map((m) => ({ id: m.id, starts_at: m.starts_at, person: m.closer_id ?? m.member_id, closer: !!m.closer_id }));
  const people: Record<string, Person> = {};
  const ids = [...new Set(booked.map((m) => m.person))];
  if (ids.length) {
    const { data: cards } = await supabase.from("profile_cards").select("id, first_name, last_name, avatar_url").in("id", ids);
    for (const c of (cards ?? []) as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[]) people[c.id] = { name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "your coach", avatar_url: c.avatar_url, bio: null };
    const admin = createAdminClient();
    if (admin) {
      /* anyone who is a call closer gets a short introduction, whether they were hired or are the lead's own coach */
      const { data: cl } = await admin.from("profiles").select("id").in("id", ids).eq("call_closer", true);
      const closerIds = ((cl ?? []) as { id: string }[]).map((r) => r.id);
      if (closerIds.length) {
        const { data: d } = await admin.from("call_closer_details").select("member_id, bio, native_language").in("member_id", closerIds);
        for (const r of (d ?? []) as { member_id: string; bio: string | null; native_language: string | null }[]) if (people[r.member_id]) { people[r.member_id].bio = introOf(r.bio); people[r.member_id].language = r.native_language; }
      }
    }
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
        <BookingPicker nowIso={new Date(nowMs()).toISOString()} slots={times} mine={booked as Mine[]} people={people} who={info.target_name ?? info.coach_name ?? "your coach"} minutes={info.call_minutes} withCloser={info.with_closer} />
      )}
    </>
  );
}

/** A short introduction: the first couple of sentences of their bio. */
function introOf(bio: string | null): string | null {
  const t = (bio ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [t];
  let out = "";
  for (const x of sentences) { if ((out + x).length > 260) break; out += x; if (out.split(/[.!?]/).filter(Boolean).length >= 2) break; }
  return (out || t.slice(0, 257) + "…").trim();
}
