"use client";

import { useEffect, useRef, useState } from "react";

/** The search button for phones. Search itself is on its way, so for now it says so. Tap anywhere to dismiss the note. */
export function SearchIcon() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!btn.current?.contains(e.target as Node)) setOpen(false); };   /* the button itself still opens and closes it */
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", away, true);
    return () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", away, true); };
  }, [open]);
  return (
    <span className="search-icon phone-only">
      <button ref={btn} type="button" className="hdr-btn" aria-label="Search" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      </button>
      {open ? <span role="status" className="search-pop">Search is coming soon.</span> : null}
    </span>
  );
}
