"use client";

import { useState } from "react";
import { suggestUsernameAction } from "@/app/welcome/actions";
import type { StepProps } from "../flow";

export function NameStep({ f, set, go, fade }: StepProps & { fade: boolean }) {
  const [busy, setBusy] = useState(false);
  const ready = Boolean(f.first.trim() && f.last.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    const first = f.first.trim(), last = f.last.trim();
    const key = (first + "|" + last).toLowerCase();
    if (!f.username || f.usernameFor !== key) {
      /* suggest a username only when there is none yet or the name changed; otherwise keep what they chose */
      setBusy(true);
      try {
        set({ first, last, username: await suggestUsernameAction(first, last), usernameFor: key });
      } finally { setBusy(false); }
    } else {
      set({ first, last });
    }
    go("username");
  }

  return (
    <section className={"step" + (fade ? " fadein" : "")}>
      <h1 className="page-heading" tabIndex={-1} style={{ marginBottom: 30 }}>What&rsquo;s your name, friend?</h1>
      <form onSubmit={submit} noValidate>
        <div className="row">
          <div className="field"><label htmlFor="first">First name</label>
            <input id="first" type="text" autoComplete="given-name" maxLength={40} required aria-required="true" value={f.first} onChange={(e) => set({ first: e.target.value })} /></div>
          <div className="field"><label htmlFor="last">Last name</label>
            <input id="last" type="text" autoComplete="family-name" maxLength={40} required aria-required="true" value={f.last} onChange={(e) => set({ last: e.target.value })} /></div>
        </div>
        <div className="actions"><button className="btn primary" disabled={!ready || busy} type="submit">{busy ? "One moment…" : "Continue"}</button></div>
      </form>
    </section>
  );
}
