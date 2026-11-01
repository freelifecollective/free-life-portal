import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { SplashMark } from "@/components/SplashMark";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RANKS } from "@/lib/buddy/questions";
import { listUpcomingCalls } from "@/lib/calls/queries";
import { endsAt, nowMs } from "@/lib/time";
import { TOUR_VERSION } from "@/lib/tour";
import { unreadMessageCount } from "@/lib/messages/queries";
import { pendingFinancingCount } from "@/lib/financing/queries";
import { pendingSubmissionCount } from "@/lib/resources/queries";

/* Every page here depends on who is signed in, so it renders per request. Revisit when adopting instant navigation. */
export const instant = false;

/** Everything inside the portal needs a signed-in member who has finished the first-login flow. */
async function SessionGate({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at) redirect("/welcome");
  const badges: Record<string, number> = {};
  let unread = 0;
  let showTour = false;
  let buddyRemind: string | null = null;
  let pendingFeedback: { call_id: string; title: string }[] = [];
  let liveNow = false;
  let waterPrompt = false;
  if (session.mode === "supabase") {
    const db = await createClient();
    const [{ count }, { data: tour }] = await Promise.all([
      db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      db.from("member_tour").select("seen_version").maybeSingle(),
    ]);
    unread = count ?? 0;
    const t = nowMs();
    liveNow = (await listUpcomingCalls(db, t)).some((c) => t >= new Date(c.starts_at).getTime() && t < endsAt(new Date(c.starts_at), c.duration_minutes).getTime());
    const { data: pf } = await db.rpc("pending_feedback");
    pendingFeedback = ((pf ?? []) as { call_id: string; title: string }[]);
    badges["/messages"] = await unreadMessageCount(db);
    {
      const [{ data: cu }, { data: go }] = await Promise.all([db.rpc("chat_unreads"), session.profile.role !== "lead" ? db.rpc("group_overview") : Promise.resolve({ data: [] })]);
      const total = ((cu ?? []) as { unread: number }[]).reduce((a, r) => a + r.unread, 0) + ((go ?? []) as { unread: number }[]).reduce((a, r) => a + r.unread, 0);
      if (total > 0) badges["/chats"] = total;
    }
    if (session.profile.role !== "lead") {
      const { data: asked } = await db.from("water_share_asked").select("member_id").maybeSingle();
      waterPrompt = !asked;
      const [{ data: ab }, { data: mp }] = await Promise.all([db.from("ab_profiles").select("pool_status, in_pool_since, complete").maybeSingle(), db.from("member_private").select("rank_id").maybeSingle()]);
      const a = ab as { pool_status: string | null; in_pool_since: string | null; complete: boolean } | null;
      const r = (mp as { rank_id: number | null } | null)?.rank_id;
      if (a?.complete && a.pool_status === "in_pool" && a.in_pool_since && r && new Date(a.in_pool_since).getTime() <= new Date().setMonth(new Date().getMonth() - 4)) buddyRemind = RANKS[r - 1];
    }
    showTour = ((tour as { seen_version: number } | null)?.seen_version ?? 0) < TOUR_VERSION;
  }
  if (session.mode === "supabase" && session.profile.role === "admin") {
    const supabase = await createClient();
    const [resources, financing] = await Promise.all([pendingSubmissionCount(supabase), pendingFinancingCount(supabase)]);
    badges["/admin/resources"] = resources;
    badges["/admin/financing"] = financing;
    const { count: closerApps } = await supabase.from("closer_applications").select("id", { count: "exact", head: true }).eq("status", "pending");
    badges["/admin/closer-applications"] = closerApps ?? 0;
  }
  return (
    <AppShell session={session} badges={badges} unread={unread} showTour={showTour} buddyRemind={buddyRemind} pendingFeedback={pendingFeedback} liveNow={liveNow} waterPrompt={waterPrompt}>
      <Suspense fallback={<div aria-busy="true" style={{ minHeight: 240 }} />}>{children}</Suspense>
    </AppShell>
  );
}

/** Shown while the portal opens: the logo with water-like ripples, the name, and a soft moving bar. Plain CSS, so it appears instantly. */
function Loading() {
  return (
    <div className="splash" role="status" aria-label="Loading the portal">
      <SplashMark />
      <p className="splash-tag">Opening your portal</p>
      <span className="splash-bar" aria-hidden="true" />
    </div>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}
