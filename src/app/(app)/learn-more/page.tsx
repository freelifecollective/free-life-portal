import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Learn More" };

export default async function LearnMorePage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role !== "lead" && session.profile.role !== "admin") redirect("/");
  if (!supabase) return <><PageHeading>Learn More</PageHeading><p className="page-lede">This needs the database.</p></>;
  return (
    <>
      <PageHeading lede="Documents to help you learn more about the Free Life Collective and what we do.">Learn More</PageHeading>
      <PlacedDocs placement="learn" />
      <p className="when">New documents are added here as they are ready.</p>
    </>
  );
}
