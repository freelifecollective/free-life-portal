"use client";

import { useActionState } from "react";
import { requestDownlineAccess, type DownlineState } from "./actions";

const initial: DownlineState = { status: "idle", message: "" };

export function DownlineForm() {
  const [state, action, pending] = useActionState(requestDownlineAccess, initial);
  if (state.status === "sent") {
    return (
      <>
        <p className="splash-tag">Check your email</p>
        <p className="login-note">We sent a sign-in link to <b translate="no">{state.message}</b>. Open it on this device to come in.</p>
      </>
    );
  }
  return (
    <>
      <p className="splash-tag">Join Lacey&apos;s downline</p>
      <p className="login-note">Enter your email and we will send you a link to come in. You will find the documents, the Water Share Map, the Main Discussion chat and the calls made for you.</p>
      <form className="login-form" action={action} noValidate>
        <label className="sr-only" htmlFor="dl-email">Email</label>
        <input id="dl-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required autoFocus />
        <p className="status bad" role="alert" style={{ margin: 0, minHeight: 22 }}>{state.status === "error" ? state.message : ""}</p>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send me a link"}</button>
      </form>
    </>
  );
}
