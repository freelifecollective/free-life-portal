"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/* Only one chat section is open at a time, like the left menu. Each device remembers which one (or "none"). */
const KEY = "flc_chat_open";
const NONE = "none";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; /* storage may be blocked */ } };
function remember(value: string) {
  try { localStorage.setItem(KEY, value); } catch { /* not saved, still works this visit */ }
  listeners.forEach((l) => l());
}

/** One section of the chat list: its heading (unchanged), an arrow beside it, and the chats underneath that fold away. */
export function ChatFold({ id, name, defaultOpen, waiting = 0, header, className, children }: { id: string; name: string; defaultOpen: boolean; waiting?: number; header: ReactNode; className?: string; children: ReactNode }) {
  const saved = useSyncExternalStore(subscribe, read, () => "");
  const open = saved ? saved === id : defaultOpen;
  return (
    <section className={className}>
      <div className="chat-fold-head">
        {header}
        {!open && waiting > 0 ? <span className="badge" aria-label={`${waiting} unread`}>{waiting > 99 ? "99+" : waiting}</span> : null}
        <button type="button" className="chat-fold-btn" aria-expanded={open} aria-label={`Show or hide ${name}`} onClick={() => remember(open ? NONE : id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }}><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {open ? children : null}
    </section>
  );
}
