import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FirstLogin } from "@/components/first-login/FirstLogin";
import { getSession } from "@/lib/auth/session";

/* Every page here depends on who is signed in, so it renders per request. Revisit when adopting instant navigation. */
export const instant = false;

export const metadata = { title: "Welcome" };

async function Welcome() {
  const session = await getSession();
  if (!session) redirect("/login");
  /* Finished members are sent on by the client, once. A redirect here would also fire right after saving. */
  return <FirstLogin env={{ mode: session.mode, userId: session.user.id }} alreadyOnboarded={Boolean(session.profile.onboarded_at)} />;
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh" }} aria-busy="true" />}>
      <Welcome />
    </Suspense>
  );
}
