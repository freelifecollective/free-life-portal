"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerForCall, type RegisterState } from "@/app/register/[callId]/actions";

export function RegisterForm({ callId }: { callId: string }) {
  const [state, run, pending] = useActionState(registerForCall.bind(null, callId), { status: "idle", message: "" } as RegisterState);
  if (state.status === "done") {
    return (
      <div role="status">
        <p style={{ fontWeight: 700, fontSize: 18 }}>You&rsquo;re registered. See you there!</p>
        <p className="page-lede" style={{ marginBottom: 20 }}>You can now sign in to the portal with the email you used. We email you a link, so there is no password to remember.</p>
        <Link className="btn primary" href="/login" style={{ textDecoration: "none" }}>Sign in to the portal</Link>
      </div>
    );
  }
  return (
    <form action={run} noValidate>
      <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" type="text" autoComplete="name" maxLength={80} required /></div>
      <div className="field" style={{ marginTop: 14 }}><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" required /></div>
      <label className="check"><input type="checkbox" name="consent" /><span>I agree to receive emails about this call and the Free Life Collective community. I can unsubscribe at any time.</span></label>
      <p className="err" role="alert" style={{ minHeight: 24 }}>{state.status === "error" ? state.message : ""}</p>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Registering…" : "Save my spot"}</button>
    </form>
  );
}
