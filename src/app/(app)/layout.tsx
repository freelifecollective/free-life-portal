import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TOUR_VERSION } from "@/lib/tour";
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
  if (session.mode === "supabase") {
    const db = await createClient();
    const [{ count }, { data: tour }] = await Promise.all([
      db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      db.from("member_tour").select("seen_version").maybeSingle(),
    ]);
    unread = count ?? 0;
    showTour = ((tour as { seen_version: number } | null)?.seen_version ?? 0) < TOUR_VERSION;
  }
  if (session.mode === "supabase" && session.profile.role === "admin") {
    const supabase = await createClient();
    const [resources, financing] = await Promise.all([pendingSubmissionCount(supabase), pendingFinancingCount(supabase)]);
    badges["/admin/resources"] = resources;
    badges["/admin/financing"] = financing;
  }
  return (
    <AppShell session={session} badges={badges} unread={unread} showTour={showTour}>
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
