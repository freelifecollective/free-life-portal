"use client";

import { useState, useTransition } from "react";
import { unsubscribe } from "./actions";

export function UnsubscribeButton({ email, token }: { email: string; token: string }) {
  const [done, setDone] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p role="status">You are unsubscribed. We will not email you again.</p>;
  return (
    <>
      <button type="button" className="btn primary" disabled={pending} onClick={() => start(async () => { const r = await unsubscribe(email, token); setDone(r.ok); })}>{pending ? "Working…" : "Yes, unsubscribe me"}</button>
      {done === false ? <p className="err" role="alert">That did not work. Please reply to one of our emails and we will take care of it.</p> : null}
    </>
  );
}
