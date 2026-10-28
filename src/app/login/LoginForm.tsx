"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle", message: "" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  if (state.status === "sent") {
    return (
      <p role="status" className="status ok" style={{ fontSize: 16 }}>
        {state.message} It can take a minute to arrive. No email? Check your spam folder, and make sure you use the address you registered with.
      </p>
    );
  }
  return (
    <form action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </div>
      <p className={"status" + (state.status === "error" ? " bad" : "")} role="alert">{state.status === "error" ? state.message : ""}</p>
      <div style={{ marginTop: 22 }}>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
      </div>
    </form>
  );
}
