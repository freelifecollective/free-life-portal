"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Phones: the tabs live behind a three-line button at the top right. `openAt` remembers which page it was opened on, so going to another page closes it. */
const Ctx = createContext<{ open: boolean; toggle: () => void; close: () => void }>({ open: false, toggle: () => {}, close: () => {} });

export function MenuProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenAt(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <Ctx.Provider value={{ open, toggle: () => setOpenAt(open ? null : path), close: () => setOpenAt(null) }}>{children}</Ctx.Provider>;
}

export function MenuButton() {
  const { open, toggle } = useContext(Ctx);
  return (
    <button type="button" className="menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="main-nav" onClick={toggle}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
      </svg>
    </button>
  );
}

export function NavPanel({ children }: { children: ReactNode }) {
  const { open } = useContext(Ctx);
  return <nav className={"nav" + (open ? " open" : "")} id="main-nav" aria-label="Main">{children}</nav>;
}
