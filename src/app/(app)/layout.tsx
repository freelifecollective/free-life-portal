import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RANKS } from "@/lib/buddy/questions";
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
  if (session.mode === "supabase") {
    const db = await createClient();
    const [{ count }, { data: tour }] = await Promise.all([
      db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      db.from("member_tour").select("seen_version").maybeSingle(),
    ]);
    unread = count ?? 0;
    const { data: pf } = await db.rpc("pending_feedback");
    pendingFeedback = ((pf ?? []) as { call_id: string; title: string }[]);
    badges["/messages"] = await unreadMessageCount(db);
    if (session.profile.role !== "lead") {
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
  }
  return (
    <AppShell session={session} badges={badges} unread={unread} showTour={showTour} buddyRemind={buddyRemind} pendingFeedback={pendingFeedback}>
      <Suspense fallback={<div aria-busy="true" style={{ minHeight: 240 }} />}>{children}</Suspense>
    </AppShell>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }} role="status" aria-label="Loading">
      <span className="brand">Free Life Collective</span>
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
