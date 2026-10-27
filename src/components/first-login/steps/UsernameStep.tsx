"use client";

import { useEffect, useRef, useState } from "react";
import { checkUsernameAction } from "@/app/welcome/actions";
import { USERNAME_MESSAGES, checkUsernameFormat } from "@/lib/username";
import type { StepProps } from "../flow";

type Status = { kind: "checking" | "ok" | "bad"; msg: string };

export function UsernameStep({ f, set, go }: StepProps) {
  const [status, setStatus] = useState<Status>({ kind: "checking", msg: "Checking…" });
  const seq = useRef(0);

  /* instant format feedback, then the real availability check once typing pauses */
  useEffect(() => {
    const u = f.username.toLowerCase();
    const fmt = checkUsernameFormat(u);
    const mine = ++seq.current;
    if (!fmt.ok) { queueMicrotask(() => mine === seq.current && setStatus({ kind: "bad", msg: USERNAME_MESSAGES[fmt.reason] })); return; }
    queueMicrotask(() => mine === seq.current && setStatus({ kind: "checking", msg: "Checking…" }));
    const t = setTimeout(async () => {
      const r = await checkUsernameAction(u);
      if (mine !== seq.current) return;
      setStatus(r.ok ? { kind: "ok", msg: "Available" } : { kind: "bad", msg: USERNAME_MESSAGES[r.reason] });
    }, 300);
    return () => clearTimeout(t);
  }, [f.username]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind !== "ok") return;
    /* Instagram is prefilled from the username (hyphens become underscores) unless they already typed one */
    set((s) => (s.igTouched ? {} : { ig: s.username.replace(/-/g, "_") }));
    go("instagram");
  }

  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>We created your username for you, feel free to change it if you like!</h1>
      <p className="page-lede">This is how people will find you inside the community.</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="uname">Your username</label>
          <div className="handle">
            <span className="at">@</span>
            <input id="uname" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={30}
              value={f.username} onChange={(e) => set({ username: e.target.value.toLowerCase() })} aria-describedby="uname-status" />
          </div>
        </div>
        <p id="uname-status" className={"status" + (status.kind === "ok" ? " ok" : status.kind === "bad" ? " bad" : "")} aria-live="polite">{status.msg}</p>
        <div className="actions"><button className="btn primary" disabled={status.kind !== "ok"} type="submit">Accept username</button></div>
      </form>
    </section>
  );
}
