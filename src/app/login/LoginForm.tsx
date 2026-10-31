"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { sendMagicLink, verifyCode, type CodeState, type LoginState } from "./actions";

const initial: LoginState = { status: "idle", message: "" };
const KEY = "flc_last_email";
const none = () => () => {};
const watchDisplay = (cb: () => void) => { const m = window.matchMedia("(display-mode: standalone)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
/** True when the portal was opened from the home-screen app (not a normal browser tab). */
const inApp = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const readSaved = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; /* storage may be blocked */ } };
const saveEmail = (v: string) => { try { if (/^\S+@\S+\.\S+$/.test(v)) localStorage.setItem(KEY, v); } catch { /* ignore */ } };

/** The sign-in card on the branded screen: ask for an email, then tell them to look for the link. */
export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  /* the email used last time on this device is filled in for you; typing replaces it */
  const saved = useSyncExternalStore(none, readSaved, () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const email = typed ?? saved;

  /* Once the emailed link has been used (in another tab), this tab moves into the portal by itself. */
  useEffect(() => {
    if (state.status !== "sent") return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("flc-login");
      ch.onmessage = (e) => { if (e.data === "signed-in") { ch?.postMessage("ack"); window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/"); } };
    } catch { /* this browser has no channel; the other tab will open the portal itself */ }
    return () => ch?.close();
  }, [state.status, next]);

  if (state.status === "sent") return <Sent email={state.email ?? email} next={state.next ?? next} />;
  return (
    <>
      <p className="splash-tag">Enter your email to login</p>
      {notice ? <p className="status bad" role="alert" style={{ margin: "6px 0 0" }}>{notice}</p> : null}
      <form className="login-form" action={action} noValidate onSubmit={() => saveEmail(email.trim().toLowerCase())}>
        <input type="hidden" name="next" value={next} />
        <label className="sr-only" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required autoFocus value={email} onChange={(e) => setTyped(e.target.value)} />
        <p className="status bad" role="alert" style={{ margin: 0, minHeight: 22 }}>{state.status === "error" ? state.message : ""}</p>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Login"}</button>
      </form>
    </>
  );
}

/** After the email is sent: look for the link, or (in the app, or if you like) type the code. */
function Sent({ email, next }: { email: string; next: string }) {
  const app = useSyncExternalStore(watchDisplay, inApp, () => false);
  const [wantsCode, setWantsCode] = useState(false);
  const [state, action, pending] = useActionState(verifyCode.bind(null, email, next), { error: "" } as CodeState);
  const showCode = app || wantsCode;
  return (
    <>
      <p className="splash-tag" role="status">{app ? "Check your email for your code" : "Check your email for your login link"}</p>
      {showCode ? (
        <form className="login-form" action={action} noValidate>
          <p className="login-note" style={{ margin: 0, textAlign: "center" }}>Type the code from the email{app ? "" : ", or just click the link"}. {app ? "In the app, the link would open your browser instead." : ""}</p>
          <label className="sr-only" htmlFor="code">Login code</label>
          <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={12} required autoFocus placeholder="Your code" style={{ letterSpacing: "0.3em", fontSize: 22 }} />
          <p className="status bad" role="alert" style={{ margin: 0, minHeight: 22 }}>{state.error}</p>
          <button className="btn primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Login"}</button>
        </form>
      ) : (
        <>
          <p className="login-note">It can take a minute to arrive. No email? Check your spam folder, and make sure you use the address you registered with.</p>
          <button type="button" className="linkbtn" style={{ marginTop: 8 }} onClick={() => setWantsCode(true)}>Using the app? Enter the code from the email instead</button>
          <span className="splash-bar" aria-hidden="true" />
        </>
      )}
    </>
  );
}
