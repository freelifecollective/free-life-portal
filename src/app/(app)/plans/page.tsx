import { PageHeading } from "@/components/PageHeading";
import { PlansView, type Bubble } from "@/components/plans/PlansView";
import { requireMember } from "@/lib/auth/guards";
import { isPlanTier } from "@/lib/plans";

export const instant = false;
export const metadata = { title: "Choose Your Plan" };

export default async function PlansPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Choose Your Plan</PageHeading><p className="page-lede">This needs the database.</p></>;
  const [{ data: counts }, { data: recent }, { data: me }] = await Promise.all([
    supabase.rpc("plan_counts"), supabase.rpc("recent_plan_purchases"), supabase.from("profiles").select("plan").eq("id", session.user.id).maybeSingle(),
  ]);
  const byTier: Record<number, number> = {};
  for (const c of (counts ?? []) as { tier: number; n: number }[]) byTier[c.tier] = c.n;
  const bubbles: Bubble[] = ((recent ?? []) as { first_name: string; tier: number; created_at: string }[]).filter((r) => isPlanTier(r.tier)).map((r) => ({ name: r.first_name, tier: r.tier, at: r.created_at }));
  const mine = (me as { plan: number | null } | null)?.plan ?? null;
  return (
    <>
      <PageHeading lede="Become a paying member and unlock everything: pick the plan that fits you. You can change it later.">Choose Your Plan</PageHeading>
      <PlansView counts={byTier} bubbles={bubbles} mine={mine} />
    </>
  );
}
