"use client";

import Link from "next/link";
import { useActionState } from "react";
import { findSupport, type FocusState } from "@/app/(app)/support/actions";
import { GROUPS, hrefOf, KIND_LABEL, type ResourceKind, type SupportHit } from "@/lib/support/types";

const initial: FocusState = { q: "", hits: null, error: "" };

function Hit({ h }: { h: SupportHit }) {
  const href = hrefOf(h);
  const external = h.kind === "resource" && !!h.url;
  const title = <strong translate="no">{h.title}</strong>;
  return (
    <li className="card-s sup-hit">
      <div>
        {href ? (external ? <a href={href} target="_blank" rel="noopener noreferrer">{title}</a> : <Link href={href}>{title}</Link>) : title}
        {h.kind === "resource" && h.sub ? <span className="doc-tag" style={{ marginLeft: 8 }}>{KIND_LABEL[h.sub as ResourceKind] ?? "Other"}</span> : null}
        {h.blurb ? <p className="when" style={{ margin: "4px 0 0" }} translate="no">{h.blurb.length > 200 ? h.blurb.slice(0, 198) + "…" : h.blurb}</p> : null}
        {h.kind === "call" && h.at ? <p className="when" style={{ margin: "4px 0 0" }}>{new Date(h.at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} Eastern</p> : null}
      </div>
    </li>
  );
}

/** "What is your focus this week?": type it in, and we suggest what can help. */
export function FocusForm() {
  const [state, action, pending] = useActionState(findSupport, initial);
  return (
    <div className="sup">
      <form action={action} className="card-s sup-form">
        <label htmlFor="sup-q" className="sr-only">What is your focus this week?</label>
        <textarea id="sup-q" name="q" rows={3} maxLength={500} required placeholder="For example: following up with leads, handling objections, staying consistent…" defaultValue={state.q} />
        <div className="rs-actions" style={{ marginTop: 8 }}><button type="submit" className="btn primary" disabled={pending}>{pending ? "Looking…" : "Show me what can help"}</button></div>
        <p className="when" style={{ margin: "8px 0 0" }}>We keep what you type so the team can see what everyone is working on and add more help.</p>
        {state.error ? <p className="err" role="alert" style={{ margin: "6px 0 0" }}>{state.error}</p> : null}
      </form>
      {state.hits ? (
        state.hits.length === 0 ? (
          <section className="card-s">
            <p style={{ margin: 0 }}>We do not have a perfect match for that yet. Try a few different words, or ask in the chats. People are glad to help.</p>
            <p style={{ margin: "10px 0 0" }}><Link className="btn small" href="/chats">Go to the chats</Link></p>
          </section>
        ) : (
          GROUPS.map((g) => {
            const list = state.hits!.filter((h) => h.kind === g.kind);
            return list.length ? (
              <section key={g.kind}>
                <h2 className="qh">{g.title}</h2>
                <ul className="sup-list">{list.map((h) => <Hit key={h.kind + h.id} h={h} />)}</ul>
              </section>
            ) : null;
          })
        )
      ) : null}
    </div>
  );
}

