"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LeadOption } from "@/app/(app)/tracking/actions";

export const NOT_IN_PORTAL = "__new";

/** A dropdown of the person's leads, A to Z, with a search box inside it and, last, "My lead isn't in the FLC Portal". */
export function LeadCombo({ options, value, onChange, label }: { options: LeadOption[]; value: string; onChange: (key: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    queueMicrotask(() => search.current?.focus());
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return t ? options.filter((o) => o.name.toLowerCase().includes(t) || (o.email ?? "").toLowerCase().includes(t)) : options; }, [options, q]);
  const chosen = value === NOT_IN_PORTAL ? "My lead isn't in the FLC Portal" : options.find((o) => o.key === value)?.name ?? "";
  const pick = (k: string) => { onChange(k); setOpen(false); setQ(""); };
  return (
    <div className="lc" ref={box}>
      <label className="lc-label" id="lc-label">{label}</label>
      <button type="button" className="lc-btn" aria-haspopup="listbox" aria-expanded={open} aria-labelledby="lc-label" onClick={() => setOpen(!open)}>
        <span translate="no">{chosen || "Choose one of your leads"}</span><span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="lc-pop">
          <input ref={search} className="lc-search" type="search" placeholder="Search names…" aria-label="Search your leads" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="lc-list" role="listbox" aria-label="Your leads">
            {shown.map((o) => <li key={o.key} role="option" aria-selected={o.key === value}><button type="button" onClick={() => pick(o.key)}><span translate="no">{o.name}</span>{o.email ? <small translate="no"> {o.email}</small> : null}</button></li>)}
            {shown.length === 0 ? <li className="lc-none">No leads match that.</li> : null}
          </ul>
          <button type="button" className="lc-other" onClick={() => pick(NOT_IN_PORTAL)}>My lead isn&apos;t in the FLC Portal</button>
        </div>
      ) : null}
    </div>
  );
}
