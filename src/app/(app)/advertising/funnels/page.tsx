import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { FunnelList, type FunnelRow } from "@/components/funnels/FunnelList";
import { FunnelTabs } from "@/components/funnels/FunnelTabs";
import { requirePlan } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Funnels" };

/** Builder and Leader: every funnel they have built, their landing page, and a way to start a new one. */
export default async function FunnelsPage() {
  const { session, supabase } = await requirePlan(97);
  const { data } = await supabase.from("funnels").select("id, name, slug, updated_at, funnel_steps(count)").eq("owner_id", session.user.id).order("updated_at", { ascending: false });
  const rows: FunnelRow[] = (data ?? []).map((f: { id: string; name: string; slug: string; updated_at: string; funnel_steps: { count: number }[] }) => ({
    id: f.id, name: f.name, slug: f.slug, updated_at: f.updated_at, steps: f.funnel_steps?.[0]?.count ?? 0,
  }));
  const username = session.profile.username;
  return (
    <>
      <PageHeading lede="Build pages that turn visitors into leads: as many funnels as you want, with as many steps as you want.">Funnels</PageHeading>
      <FunnelTabs current="/advertising/funnels" />
      <section className="fn-landing card-s" aria-labelledby="fn-lp">
        <div>
          <h2 id="fn-lp" className="qh" style={{ margin: 0 }}>Your landing page</h2>
          <p className="when" style={{ margin: "4px 0 0" }}>The page that comes with your account. Change its words, video and picture, or build something completely new as a funnel.</p>
        </div>
        <div className="fn-landing-actions">
          <Link className="btn" href="/advertising/landing-page">Change my landing page</Link>
          {username ? <Link className="linkbtn" href={`/${username}`} target="_blank" rel="noopener noreferrer">Open it</Link> : null}
        </div>
      </section>
      <FunnelList funnels={rows} username={username ?? null} />
    </>
  );
}
