import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { getSession } from "@/lib/auth/session";
import { previewMode, supabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "56px max(16px, env(safe-area-inset-left)) 64px" }}>
      <div className="label" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 36 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} />
        Free Life Collective
      </div>
      <PageHeading lede="We will email you a link that signs you in. No password needed.">Welcome back</PageHeading>
      {children}
    </main>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const linkFailed = sp.error === "link";
  if (await getSession()) redirect("/");

  return (
    <Shell>
      {linkFailed ? <p className="status bad" role="alert" style={{ marginTop: 0 }}>That sign-in link has expired or was already used. Request a new one below.</p> : null}
      {supabaseConfigured ? (
        <LoginForm next={next} />
      ) : previewMode ? (
        <div>
          <p className="status" style={{ marginTop: 0 }}>
            Preview mode: no sign-in is set up yet, so you can try the first-login flow without an account.
          </p>
          <Link className="btn primary" href="/welcome" style={{ textDecoration: "none" }}>Start the first-login flow</Link>
        </div>
      ) : (
        <p className="status bad" role="alert">This site is not configured yet. Please contact support.</p>
      )}
    </Shell>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<Shell>{null}</Shell>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
