import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth/session";

/* Every page here depends on who is signed in, so it renders per request. Revisit when adopting instant navigation. */
export const instant = false;

/** Everything inside the portal needs a signed-in member who has finished the first-login flow. */
async function SessionGate({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at) redirect("/welcome");
  return (
    <AppShell session={session}>
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
