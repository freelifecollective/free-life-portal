"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { GhostKind } from "@/lib/locked";
import { PreviewBoundary } from "./PreviewBoundary";

/** A very faint, grey outline of the page (just the rough shape of what is inside). */
function Ghost({ kind }: { kind: GhostKind }) {
  const bar = (w: string, h = 14) => <span className="lk-bar" style={{ width: w, height: h }} />;
  const card = (i: number) => <div key={i} className="lk-card"><span className="lk-img" />{bar("70%")}{bar("45%", 10)}</div>;
  switch (kind) {
    case "cards": return <div className="lk-grid">{[0, 1, 2, 3, 4, 5].map(card)}</div>;
    case "gallery": return <div className="lk-grid lk-grid-sm">{Array.from({ length: 10 }, (_, i) => card(i))}</div>;
    case "list": return <div className="lk-stack">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="lk-row"><span className="lk-dot" />{bar(`${55 + (i % 3) * 15}%`)}</div>)}</div>;
    case "table": return <div className="lk-stack">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="lk-row">{bar("18%")}{bar("14%")}{bar("14%")}{bar("14%")}{bar("14%")}</div>)}</div>;
    case "form": return <div className="lk-split"><div className="lk-stack">{bar("40%", 16)}{bar("100%", 40)}{bar("100%", 40)}{bar("100%", 40)}</div><span className="lk-img lk-tall" /></div>;
    case "video": return <div className="lk-split"><span className="lk-img lk-wide" /><div className="lk-stack">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="lk-row"><span className="lk-dot" />{bar("80%")}</div>)}</div></div>;
    case "tree": return <div className="lk-tree"><span className="lk-node" /><div><span className="lk-node" /><span className="lk-node" /></div><div><span className="lk-node" /><span className="lk-node" /><span className="lk-node" /><span className="lk-node" /></div></div>;
    default: return <div className="lk-grid">{[0, 1, 2, 3, 4, 5].map(card)}</div>;
  }
}

/** The locked page: its name and subtitle in full, the rough shape of the page greyed out, and the "members only" message on top. */
export function LockedTeaser({ title, lede, kind, preview, ownHeading = false }: { title: string; lede: string; kind: GhostKind; preview?: ReactNode; ownHeading?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="lk">
      <h1 className="sr-only">{title}</h1>
      <div className={"lk-ghost" + (preview ? " lk-live" : "")} aria-hidden="true" inert>{ownHeading ? null : <><p className="page-heading" role="presentation">{title}</p><p className="page-lede">{lede}</p></>}
        {preview ? <PreviewBoundary fallback={<Ghost kind={kind} />}>{preview}</PreviewBoundary> : <Ghost kind={kind} />}</div>
      <div className="lk-cover" onClick={() => setOpen(true)} aria-hidden="true" />
      {open ? (
        <div className="lk-overlay" role="dialog" aria-modal="true" aria-labelledby="lk-title">
          <div className="lk-box">
            <h2 id="lk-title" className="qh" style={{ marginTop: 0 }}>Members only</h2>
            <p>Sorry, this feature is only available to paying members.</p>
            <div className="dlg-actions">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
              <Link className="btn primary" href="/plans" style={{ textDecoration: "none" }}>See the plans</Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="lk-bar-bottom" role="status"><span>🔒 Paying members get this.</span><Link className="btn small primary" href="/plans" style={{ textDecoration: "none" }}>See the plans</Link></div>
      )}
    </div>
  );
}
