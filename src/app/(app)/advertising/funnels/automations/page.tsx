import { PageHeading } from "@/components/PageHeading";
import { FunnelTabs } from "@/components/funnels/FunnelTabs";
import { requirePlan } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  await requirePlan(97);
  return (
    <>
      <PageHeading lede="Set up follow-up that runs on its own when someone fills in one of your forms.">Automations</PageHeading>
      <FunnelTabs current="/advertising/funnels/automations" />
      <p className="card-s" style={{ margin: 0 }}>This is being built now and will appear here soon.</p>
    </>
  );
}
