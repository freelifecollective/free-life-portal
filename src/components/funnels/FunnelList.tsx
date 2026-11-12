"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFunnel, deleteFunnel, duplicateFunnel } from "@/app/(app)/advertising/funnels/actions";

export type FunnelRow = { id: string; name: string; slug: string; updated_at: string; steps: number };

/** The member's funnels, and the box to start a new one. */
export function FunnelList({ funnels, username }: { funnels: FunnelRow[]; username: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<"optin" | "blank">("optin");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const link = (f: FunnelRow) => (username ? `${typeof window === "undefined" ? "" : window.location.origin}/f/${username}/${f.slug}` : "");

  return (
    <div className="fn-list">
      <form className="fn-new card-s" onSubmit={(e) => {
        e.preventDefault(); setMsg("");
        start(async () => { const r = await createFunnel(name, template); if (r.ok && r.id) router.push(`/advertising/funnels/${r.id}`); else setMsg(r.error ?? "Something went wrong."); });
      }}>
        <h2 className="qh" style={{ margin: 0 }}>Start a new funnel</h2>
        <div className="field"><label htmlFor="fn-name">Funnel name</label><input id="fn-name" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Free guide" required /></div>
        <div className="fn-templates" role="radiogroup" aria-label="Start from">
          <label className={"fn-template" + (template === "optin" ? " on" : "")}><input type="radio" name="tpl" checked={template === "optin"} onChange={() => setTemplate("optin")} /><b>Opt-in funnel</b><span>An opt-in page with a video and a form, and a thank-you page.</span></label>
          <label className={"fn-template" + (template === "blank" ? " on" : "")}><input type="radio" name="tpl" checked={template === "blank"} onChange={() => setTemplate("blank")} /><b>Blank</b><span>One empty page to build from scratch.</span></label>
        </div>
        <button type="submit" className="btn primary" disabled={pending || !name.trim()}>Create funnel</button>
        {msg ? <p className="status bad" role="alert">{msg}</p> : null}
      </form>

      {funnels.length === 0 ? <p className="when">You have not built any funnels yet.</p> : (
        <ul className="fn-cards">
          {funnels.map((f) => (
            <li key={f.id} className="fn-card">
              <div>
                <h3 translate="no">{f.name}</h3>
                <p className="when">{f.steps === 1 ? "1 page" : `${f.steps} pages`}</p>
              </div>
              <div className="fn-card-actions">
                <Link className="btn primary small" href={`/advertising/funnels/${f.id}`}>Edit</Link>
                {username ? <a className="btn small" href={`/f/${username}/${f.slug}`} target="_blank" rel="noopener noreferrer">Open</a> : null}
                {username ? <button type="button" className="linkbtn" onClick={() => { void navigator.clipboard?.writeText(link(f)); setCopied(f.id); }}>{copied === f.id ? "Link copied ✓" : "Copy link"}</button> : null}
                <button type="button" className="linkbtn" disabled={pending} onClick={() => start(async () => { await duplicateFunnel(f.id); router.refresh(); })}>Duplicate</button>
                <button type="button" className="linkbtn danger" disabled={pending} onClick={() => { if (window.confirm(`Delete "${f.name}" and all its pages? This cannot be undone.`)) start(async () => { await deleteFunnel(f.id); router.refresh(); }); }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
