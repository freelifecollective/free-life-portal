import { PageHeading } from "@/components/PageHeading";
import { WaterMap } from "@/components/water/WaterMap";
import { MyWaterEntry, type WaterMine } from "@/components/water/WaterShareDialog";
import { requireMember } from "@/lib/auth/guards";
import type { WaterPin } from "@/lib/water/types";

export const instant = false; // depends on who is signed in
export const metadata = { title: "Water Share Map" };

export default async function WaterMapPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Water Share Map</PageHeading><p className="page-lede">The map needs the database, which preview mode does not have.</p></>;
  const [{ data: pins }, { data: mine }] = await Promise.all([
    supabase.rpc("water_share_map"),
    supabase.from("water_share").select("place, prefilter, water_type").eq("member_id", session.user.id).maybeSingle(),
  ]);
  return (
    <>
      <PageHeading lede="Find an affiliate near your lead who is willing to share water.">Water Share Map</PageHeading>
      <div className="ws-page">
        <MyWaterEntry mine={(mine as WaterMine) ?? null} />
        <WaterMap pins={(pins ?? []) as WaterPin[]} myId={session.user.id} />
        <p className="when ws-policy">Reminder: we have a strict policy on lead poaching. Anyone found taking leads from other people while offering a water share will be removed from the community. The member making the sale is encouraged to offer compensation for sharing water, though it is not required.</p>
      </div>
    </>
  );
}
