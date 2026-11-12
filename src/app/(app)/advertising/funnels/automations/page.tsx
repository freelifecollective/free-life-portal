import { PageHeading } from "@/components/PageHeading";
import { AutomationsView, type Auto } from "@/components/funnels/AutomationsView";
import { FunnelTabs } from "@/components/funnels/FunnelTabs";
import { requirePlan } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const { session, supabase } = await requirePlan(97);
  const [{ data: autos }, { data: funnels }, { data: msgs }] = await Promise.all([
    supabase.from("automations").select("id, name, funnel_id, active, steps").eq("owner_id", session.user.id).order("updated_at", { ascending: false }),
    supabase.from("funnels").select("id, name").eq("owner_id", session.user.id).order("name"),
    supabase.from("member_messages").select("id, name, kind").eq("owner_id", session.user.id).order("name"),
  ]);
  return (
    <>
      <PageHeading lede="Follow-up that runs on its own: when someone fills in one of your forms, your emails and texts go out at the times you choose.">Automations</PageHeading>
      <FunnelTabs current="/advertising/funnels/automations" />
      <AutomationsView automations={(autos ?? []) as Auto[]} funnels={funnels ?? []} messages={(msgs ?? []) as { id: string; name: string; kind: "email" | "text" }[]} />
    </>
  );
}
