import { UnsubscribeButton } from "./UnsubscribeButton";
import { verifyUnsubscribe } from "@/lib/email/token";

export const metadata = { title: "Unsubscribe" };
export const instant = false;

export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const email = one(sp.e), token = one(sp.t);
  const valid = verifyUnsubscribe(email, token);
  return (
    <main style={{ maxWidth: 520, margin: "10vh auto", padding: "0 20px", fontFamily: "var(--font-label, system-ui)" }}>
      <h1 className="qh">Unsubscribe</h1>
      {valid ? (
        <>
          <p>Stop emails from the Free Life Collective to <b translate="no">{email}</b>?</p>
          <UnsubscribeButton email={email} token={token} />
        </>
      ) : <p>This unsubscribe link is not valid. If you would like to stop our emails, reply to any of them and we will take care of it.</p>}
    </main>
  );
}
