import Link from "next/link";
import { SplashMark } from "@/components/SplashMark";
import { AutoSubmit } from "../AutoSubmit";

export const metadata = { title: "Opening your portal" };
export const instant = false;

/**
 * Where the login link in the email lands. It shows the "Opening your portal" screen and signs the person in by itself.
 * The sign-in is sent from the page (not on the first request) because some email programs "open" every link to check
 * it for viruses, and that would otherwise use the one-time link up before the person ever clicks it.
 */
export default async function ConfirmPage(props: PageProps<"/auth/confirm">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tokenHash = one(sp.token_hash);
  return (
    <main className="splash login-splash" role="status" aria-label="Opening your portal">
      <SplashMark />
      {tokenHash ? (
        <>
          <p className="splash-tag">Opening your portal</p>
          <span className="splash-bar" aria-hidden="true" />
          <AutoSubmit tokenHash={tokenHash} type={one(sp.type) || "email"} next={one(sp.next)} />
        </>
      ) : (
        <>
          <p className="splash-tag">This link looks incomplete</p>
          <p className="login-note">Please ask for a new login link.</p>
          <Link className="btn primary" href="/login" style={{ textDecoration: "none", marginTop: 14 }}>Back to login</Link>
        </>
      )}
    </main>
  );
}
