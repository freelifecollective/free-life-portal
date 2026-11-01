import Link from "next/link";
import { redirect } from "next/navigation";
import { AvailabilityPanel } from "@/components/booking/AvailabilityPanel";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "My Availability" };

export default async function AvailabilityPage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  if (!supabase) return <><PageHeading>My Availability</PageHeading><p className="page-lede">This needs the database.</p></>;
  return (
    <>
      <PageHeading lede="Leads you bring in pick a free time inside these hours to book a coaching call with you. If you have hired a call closer, they book the closer's hours instead.">My Availability</PageHeading>
      <p style={{ margin: "-8px 0 16px" }}><Link className="linkbtn" href="/settings">← Back to settings</Link></p>
      <AvailabilityPanel supabase={supabase} userId={session.user.id} />
    </>
  );
}
