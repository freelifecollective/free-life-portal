import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { QuotePicker } from "@/components/quote/QuotePicker";
import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Create a Quote" };

export default async function CreateQuotePage() {
  const { session } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  return (
    <>
      <PageHeading lede="Choose the products, add your lead's name, tax and shipping, and send them a quote they can keep or share.">Create a Quote</PageHeading>
      <PlacedDocs placement="quote" />
      <QuotePicker />
    </>
  );
}
