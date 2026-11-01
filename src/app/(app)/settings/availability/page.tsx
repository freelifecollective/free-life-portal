import Link from "next/link";
import { redirect } from "next/navigation";
import { AvailabilityForm } from "@/components/booking/AvailabilityForm";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import type { Hours } from "@/lib/booking/times";
import { getTz } from "@/lib/tasks/queries";

export const instant = false;
export const metadata = { title: "My open hours" };

export default async function AvailabilityPage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  if (!supabase) return <><PageHeading>My open hours</PageHeading><p className="page-lede">This needs the database.</p></>;
  const [{ data: hours }, { data: cs }, tzDefault] = await Promise.all([
    supabase.from("coach_availability").select("weekday, start_min, end_min").eq("member_id", session.user.id),
    supabase.from("coach_settings").select("call_minutes, tz").eq("member_id", session.user.id).maybeSingle(),
    getTz(supabase),
  ]);
  const zones = Intl.supportedValuesOf("timeZone");
  const tz = (cs as { tz: string } | null)?.tz ?? tzDefault;
  return (
    <>
      <PageHeading lede="Leads you bring in pick a free time inside these hours to book a coaching call with you. If you have hired a call closer, they book the closer's hours instead.">My open hours</PageHeading>
      <p style={{ margin: "-8px 0 16px" }}><Link className="linkbtn" href="/settings">← Back to settings</Link></p>
      <section className="card-s" style={{ maxWidth: 640 }}>
        <AvailabilityForm hours={(hours ?? []) as Hours[]} minutes={(cs as { call_minutes: number } | null)?.call_minutes ?? 30} tz={zones.includes(tz) ? tz : "America/New_York"} zones={zones} />
      </section>
    </>
  );
}
