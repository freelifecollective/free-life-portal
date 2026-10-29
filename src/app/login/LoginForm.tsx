"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle", message: "" };
const KEY = "flc_last_email";
const none = () => () => {};
const readSaved = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; /* storage may be blocked */ } };
const saveEmail = (v: string) => { try { if (/^\S+@\S+\.\S+$/.test(v)) localStorage.setItem(KEY, v); } catch { /* ignore */ } };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  /* the email used last time on this device is filled in for you; typing replaces it */
  const saved = useSyncExternalStore(none, readSaved, () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const email = typed ?? saved;
  if (state.status === "sent") {
    return (
      <p role="status" className="status ok" style={{ fontSize: 16 }}>
        {state.message} It can take a minute to arrive. No email? Check your spam folder, and make sure you use the address you registered with.
      </p>
    );
  }
  return (
    <form action={action} noValidate onSubmit={() => saveEmail(email.trim().toLowerCase())}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <p className={"status" + (state.status === "error" ? " bad" : "")} role="alert">{state.status === "error" ? state.message : ""}</p>
      <div style={{ marginTop: 22 }}>
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
      </div>
    </form>
  );
}
