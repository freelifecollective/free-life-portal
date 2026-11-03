"use client";

/** A little bin. One tap deletes straight away (the undo arrows bring it back). */
export function TrashButton({ label, busy, onConfirm }: { label: string; busy?: boolean; onConfirm: () => void }) {
  return (
    <span className="trash-wrap">
      <button type="button" className="icon-btn trash" aria-label={`Delete: ${label}`} disabled={busy} onClick={onConfirm}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 5v6m4-6v6" /></svg>
      </button>
    </span>
  );
}
