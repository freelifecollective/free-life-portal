import { redirect } from "next/navigation";
import { CloserHub, type Stats } from "@/components/closer-hub/CloserHub";
import { AvailabilityPanel } from "@/components/booking/AvailabilityPanel";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import type { HubCall } from "@/lib/closer/types";
import { isAffiliate } from "@/lib/roles";
import { nowMs } from "@/lib/time";

export const instant = false;
export const metadata = { title: "Booking Calendar" };

/** For affiliates who are not call closers: the same calendar page a call closer has, without the money and client parts. A call closer's calendar is the same one, so they are sent to their Call Closer page. */
export default async function BookingCalendarPage(props: PageProps<"/booking-calendar">) {
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  if (!supabase) return <><PageHeading>Booking Calendar</PageHeading><p className="page-lede">This needs the database.</p></>;
  const me = session.user.id;
  const { data: prof } = await supabase.from("profiles").select("call_closer").eq("id", me).maybeSingle();
  if ((prof as { call_closer: boolean } | null)?.call_closer) redirect("/call-closer");
  const { data: rows } = await supabase.from("booked_calls").select("id, member_id, lead_name, lead_id, completed_at, starts_at, note, outcome, pay_points, pay_call_cents, pay_products_cents, pay_currency, paid_cents, paid_at").eq("member_id", me).is("closer_id", null).order("starts_at", { ascending: false }).limit(300);
  const calls: HubCall[] = ((rows ?? []) as Omit<HubCall, "products">[]).map((c) => ({ ...c, products: {} }));
  const taken = calls.filter((c) => c.outcome === "took_place" || (c.completed_at && c.outcome === null)).length;
  const stats: Stats = { calls: String(taken), recorded: 0, closed: 0, closeRate: "–", rating: null, reviews: 0, members: "0" };
  return (
    <>
      <PageHeading lede="Set when you are open, and the leads you bring in pick a free time to book a call with you. If you become a call closer, this moves to your Call Closer page.">Booking Calendar</PageHeading>
      <CloserHub personal clients={null} availability={<AvailabilityPanel supabase={supabase} userId={me} googleStatus={typeof sp.google === "string" ? sp.google : null} />} now={nowMs()} calls={calls} people={{}} rules={[]} stats={stats} price={null} />
    </>
  );
}
