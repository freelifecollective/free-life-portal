import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { LeadBoard } from "@/components/tracking/LeadBoard";
import { requireMember } from "@/lib/auth/guards";
import { loadBoards } from "@/lib/tracking/queries";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Lead Tracking" };

export default async function LeadTrackingPage() {
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  if (!supabase) return <><PageHeading>Lead Tracking</PageHeading><p className="page-lede">This needs the database.</p></>;
  const boards = await loadBoards(supabase);
  return (
    <>
      <PageHeading lede="Keep track of where each of your leads is. Drag a card from list to list, add your own boards and lists, and press “Registered for the Portal” or “Affiliated” when they take that step.">Lead Tracking</PageHeading>
      <PlacedDocs placement="tracking" />
      <LeadBoard initial={boards} />
    </>
  );
}
