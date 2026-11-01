"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setMute, type MuteMode } from "@/app/(app)/chats/mute-actions";

/** Icon for a muted chat (a bell with a line through it). */
export function MutedIcon() {
  return (
    <svg className="mute-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Muted">
      <path d="M8.7 3A6 6 0 0 1 18 8c0 2.9.6 4.9 1.3 6.1M6.3 6.3C6.1 6.9 6 7.4 6 8c0 7-3 9-3 9h14M10.3 21a1.9 1.9 0 0 0 3.4 0M2 2l20 20" />
    </svg>
  );
}

/**
 * Right-click (or press and hold on a phone) a chat to get the mute menu, like Telegram:
 * for 1 hour, 8 hours, 3 days, until a date and time, or forever. A muted chat shows Unmute instead.
 */
export function MuteMenu({ kind, id, muted, children }: { kind: "chat" | "group"; id: string; muted: boolean; children: ReactNode }) {
  const router = useRouter();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [pending, start] = useTransition();
  const dlg = useRef<HTMLDialogElement>(null);
  const [when, setWhen] = useState("");
  const [error, setError] = useState("");
  const hold = useRef<number | undefined>(undefined);
  const held = useRef(false);

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); window.removeEventListener("keydown", onKey); };
  }, [at]);

  const apply = (mode: MuteMode) => { setAt(null); start(async () => { await setMute(kind, id, mode); router.refresh(); }); };
  const open = (x: number, y: number) => setAt({ x: Math.min(x, window.innerWidth - 230), y: Math.min(y, window.innerHeight - 270) });
  const stop = () => window.clearTimeout(hold.current);

  return (
    <div
      className="mute-wrap" data-pending={pending || undefined}
      onContextMenu={(e) => { e.preventDefault(); open(e.clientX, e.clientY); }}
      onTouchStart={(e) => { held.current = false; const t = e.touches[0]; hold.current = window.setTimeout(() => { held.current = true; open(t.clientX, t.clientY); }, 550); }}
      onTouchMove={stop} onTouchEnd={stop} onTouchCancel={stop}
      onClickCapture={(e) => { if (held.current) { e.preventDefault(); e.stopPropagation(); held.current = false; } }}
    >
      {children}
      {at ? (
        <div className="mute-menu" role="menu" style={{ left: at.x, top: at.y }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          {muted ? (
            <button type="button" role="menuitem" onClick={() => apply("off")}>Unmute</button>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => apply("1h")}>For 1 Hour</button>
              <button type="button" role="menuitem" onClick={() => apply("8h")}>For 8 Hours</button>
              <button type="button" role="menuitem" onClick={() => apply("3d")}>For 3 Days</button>
              <hr />
              <button type="button" role="menuitem" onClick={() => { setAt(null); setError(""); setWhen(""); dlg.current?.showModal(); }}>Mute Until…</button>
              <button type="button" role="menuitem" onClick={() => apply("forever")}>Forever</button>
            </>
          )}
        </div>
      ) : null}
      <dialog ref={dlg} className="rs-dialog" aria-label="Mute until" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <form className="set-form" onSubmit={(e) => {
          e.preventDefault();
          const t = new Date(when);
          if (!when || !Number.isFinite(t.getTime()) || t.getTime() <= Date.now()) { setError("Pick a time in the future."); return; }
          dlg.current?.close(); apply({ until: t.toISOString() });
        }}>
          <h2 className="qh" style={{ margin: 0 }}>Mute Until…</h2>
          <div className="field"><label htmlFor={`mu-${id}`}>Date and time</label><input id={`mu-${id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required /></div>
          <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p>
          <div className="dlg-actions"><button className="btn" type="button" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn primary" type="submit">Mute</button></div>
        </form>
      </dialog>
    </div>
  );
}
