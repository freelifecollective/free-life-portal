import Link from "next/link";
import { SplashMark } from "@/components/SplashMark";

export const metadata = { title: "Enter the portal" };
export const instant = false;

/**
 * Where the login link in the email lands. It asks for one tap before the link is used up, because some email programs
 * "open" every link to check it for viruses, which would otherwise use the link before the person ever sees it.
 */
export default async function ConfirmPage(props: PageProps<"/auth/confirm">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tokenHash = one(sp.token_hash);
  const type = one(sp.type) || "email";
  const next = one(sp.next);
  return (
    <main className="splash login-splash">
      <SplashMark />
      {tokenHash ? (
        <>
          <p className="splash-tag">You&rsquo;re almost in</p>
          <form className="login-form" method="post" action="/auth/verify">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <button className="btn primary" type="submit">Enter the portal</button>
          </form>
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
