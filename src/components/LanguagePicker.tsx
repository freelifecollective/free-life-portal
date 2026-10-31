"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, currentLang, setLanguage, type LangCode } from "@/lib/language";

const globe = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>
);

/** The language switcher. "dropdown" is a globe button in the top bar; "list" is a plain row of choices (used in the account menu and on the login screen). */
export function LanguagePicker({ variant = "dropdown" }: { variant?: "dropdown" | "list" }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>("en");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = window.setTimeout(() => setLang(currentLang()), 0); return () => window.clearTimeout(t); }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const choices = (
    <ul className="lang-list" translate="no" role="menu" aria-label="Language">
      {LANGS.map((l) => (
        <li key={l.code} role="none">
          <button type="button" role="menuitemradio" aria-checked={lang === l.code} className={lang === l.code ? "on" : ""} onClick={() => (lang === l.code ? setOpen(false) : setLanguage(l.code))}>
            {l.label}{lang === l.code ? <span aria-hidden="true"> ✓</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );

  if (variant === "list") return <div className="lang-inline" translate="no"><span className="lang-label">Language</span>{choices}</div>;

  return (
    <div className="lang-wrap" ref={box} translate="no">
      <button type="button" className="hdr-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Change language" title="Language" onClick={() => setOpen(!open)}>{globe}</button>
      {open ? <div className="lang-pop">{choices}</div> : null}
    </div>
  );
}
