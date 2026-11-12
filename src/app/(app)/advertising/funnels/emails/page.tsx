import { PageHeading } from "@/components/PageHeading";
import { FunnelTabs } from "@/components/funnels/FunnelTabs";
import { requirePlan } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Emails" };

export default async function EmailsPage() {
  await requirePlan(97);
  return (
    <>
      <PageHeading lede="Ready-made emails and texts you can change, and your own.">Emails</PageHeading>
      <FunnelTabs current="/advertising/funnels/emails" />
      <p className="card-s" style={{ margin: 0 }}>This is being built now and will appear here soon.</p>
    </>
  );
}
