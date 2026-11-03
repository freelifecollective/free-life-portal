import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { FocusForm } from "@/components/support/FocusForm";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Weekly Focus" };

export default async function SupportPage() {
  const { supabase } = await requireMember();
  if (!supabase) return <><PageHeading>{"What's your focus this week?"}</PageHeading><p className="page-lede">This needs the database, which preview mode does not have.</p></>;
  return (
    <>
      <PageHeading lede="What do you want to improve on or deepen your knowledge in?">{"What's your focus this week?"}</PageHeading>
      <PlacedDocs placement="weekly" />
      <FocusForm />
    </>
  );
}
