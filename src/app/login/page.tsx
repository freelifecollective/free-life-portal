import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SplashMark } from "@/components/SplashMark";
import { getSession } from "@/lib/auth/session";
import { previewMode, supabaseConfigured } from "@/lib/env";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="splash login-splash">
      <SplashMark />
      {children}
      <div className="login-lang"><LanguagePicker variant="list" /></div>
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
      {supabaseConfigured ? (
        <LoginForm next={next} notice={linkFailed ? "That login link has expired or was already used. Enter your email to get a new one." : undefined} />
      ) : previewMode ? (
        <>
          <p className="splash-tag">Preview mode</p>
          <p className="login-note">No login is set up yet, so you can try the first-login flow without an account.</p>
          <Link className="btn primary" href="/welcome" style={{ textDecoration: "none", marginTop: 14 }}>Start the first-login flow</Link>
        </>
      ) : (
        <p className="status bad" role="alert">This site is not configured yet. Please contact support.</p>
      )}
    </Shell>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<Shell><p className="splash-tag">&nbsp;</p></Shell>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
