import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { ListingForm } from "@/components/outsourcing/ListingForm";
import { ProviderList } from "@/components/outsourcing/ProviderList";
import { requireMember } from "@/lib/auth/guards";
import { loadOutsourcing } from "@/lib/outsourcing/queries";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Outsourcing" };

export default async function OutsourcingPage() {
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  if (!supabase) return <><PageHeading>Outsourcing</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { providers, mine, hired, reviews } = await loadOutsourcing(supabase, session.user.id);
  return (
    <>
      <PageHeading lede="Find help from people in the community, or offer your own skills.">Outsourcing</PageHeading>
      <PlacedDocs placement="outsourcing" />
      <div className="stack">
        <ListingForm mine={mine} />
        <ProviderList providers={providers} hired={hired} reviews={reviews} me={session.user.id} isAdmin={session.profile.role === "admin"} />
      </div>
    </>
  );
}
