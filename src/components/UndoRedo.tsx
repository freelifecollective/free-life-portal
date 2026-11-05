"use client";

import { useEffect, useRef } from "react";

/** The undo and redo arrows, the same everywhere in the portal (as in the Your Organization chart). Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work too, except while typing in a box. */
export function UndoRedo({ canUndo, canRedo, onUndo, onRedo, busy = false }: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; busy?: boolean }) {
  const live = useRef({ canUndo, canRedo, onUndo, onRedo, busy });
  useEffect(() => { live.current = { canUndo, canRedo, onUndo, onRedo, busy }; });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const k = e.key.toLowerCase(); const l = live.current;
      if (l.busy) return;
      if (k === "z" && !e.shiftKey && l.canUndo) { e.preventDefault(); l.onUndo(); }
      else if (((k === "z" && e.shiftKey) || k === "y") && l.canRedo) { e.preventDefault(); l.onRedo(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <div className="ft-hist" role="group" aria-label="Undo and redo">
      <button type="button" disabled={busy || !canUndo} onClick={onUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button>
      <button type="button" disabled={busy || !canRedo} onClick={onRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
    </div>
  );
}
