"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerFromLanding } from "@/app/[username]/actions";
import type { RegisterState } from "@/lib/registration";

export function LandingRegister({ username, callId }: { username: string; callId: string }) {
  const [state, run, pending] = useActionState(registerFromLanding.bind(null, username, callId), { status: "idle", message: "" } as RegisterState);
  if (state.status === "done") {
    return (
      <div role="status" className="lp-done">
        <p className="lp-done-title">You&rsquo;re registered. See you there!</p>
        <p>Next, set up your free community account. It takes a minute, and it&rsquo;s where you&rsquo;ll find the call and a ton of other resources.</p>
        <Link className="btn primary" href="/login" style={{ textDecoration: "none" }}>Set up my free account</Link>
      </div>
    );
  }
  return (
    <form action={run} noValidate className="lp-form">
      <div className="row">
        <div className="field"><label htmlFor="first">First name</label><input id="first" name="first" type="text" autoComplete="given-name" maxLength={40} required /></div>
        <div className="field"><label htmlFor="last">Last name</label><input id="last" name="last" type="text" autoComplete="family-name" maxLength={40} required /></div>
      </div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" required /></div>
      <label className="check"><input type="checkbox" name="consent" /><span>I agree to receive emails about this call and the Free Life Collective community. I can unsubscribe at any time.</span></label>
      <p className="err" role="alert" style={{ minHeight: 24, margin: "0 0 10px" }}>{state.status === "error" ? state.message : ""}</p>
      <button className="btn primary" type="submit" disabled={pending} style={{ width: "100%" }}>{pending ? "Saving your spot…" : "Save my free spot"}</button>
    </form>
  );
}
