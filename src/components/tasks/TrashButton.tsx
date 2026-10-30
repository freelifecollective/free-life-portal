"use client";

import { useEffect, useRef, useState } from "react";

/** A little bin. One tap opens a small "Delete?" question right beside it, so the mouse barely has to move. */
export function TrashButton({ label, busy, onConfirm }: { label: string; busy?: boolean; onConfirm: () => void }) {
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
        <span className="trash-pop" role="alertdialog" aria-label="Delete this task?">
          <span>Delete this task?</span>
          <span className="trash-btns">
            <button type="button" className="btn small" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn small danger-fill" autoFocus disabled={busy} onClick={() => { setOpen(false); onConfirm(); }}>Delete</button>
          </span>
        </span>
      ) : null}
    </span>
  );
}
