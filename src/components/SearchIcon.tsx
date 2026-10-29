"use client";

import { useState } from "react";

/** The search button for phones. Search itself is on its way, so for now it says so. */
export function SearchIcon() {
  const [open, setOpen] = useState(false);
  return (
    <span className="search-icon phone-only">
      <button type="button" className="hdr-btn" aria-label="Search" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      </button>
      {open ? <span role="status" className="search-pop">Search is coming soon.</span> : null}
    </span>
  );
}
