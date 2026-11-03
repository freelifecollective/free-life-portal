"use client";

import { useEffect, useRef, useState } from "react";

/** A little bin. One tap opens a small right-click style menu right beside it: Delete, or Cancel. */
export function TrashButton({ label, busy, onConfirm, deleteText = "Delete" }: { label: string; busy?: boolean; onConfirm: () => void; deleteText?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <span className="trash-wrap" ref={box}>
      <button type="button" className="icon-btn trash" aria-label={`Delete: ${label}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 5v6m4-6v6" /></svg>
      </button>
      {open ? (
        <span className="trash-menu" role="menu" aria-label={`Delete ${label}?`}>
          <button type="button" role="menuitem" className="trash-item danger" autoFocus disabled={busy} onClick={() => { setOpen(false); onConfirm(); }}>{deleteText}</button>
          <button type="button" role="menuitem" className="trash-item" onClick={() => setOpen(false)}>Cancel</button>
        </span>
      ) : null}
    </span>
  );
}
