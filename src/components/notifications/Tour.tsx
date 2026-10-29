"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { completeTour } from "@/app/(app)/notifications/actions";

type Step = { title: string; body: string; target?: () => HTMLElement | null };
const isPhone = () => window.matchMedia("(max-width: 768px)").matches;
const STEPS: Step[] = [
  { title: "Welcome to the Free Life Collective!", body: "Take a quick tour (about 30 seconds) to see where everything is. You can skip it any time." },
  { title: "Everything lives in the menu", body: "Calendar, chats, financing and more. On a phone, tap the three lines to open it.", target: () => document.querySelector<HTMLElement>(isPhone() ? ".menu-btn" : "#main-nav") },
  { title: "Your notifications", body: "New leads, call reminders, approvals and announcements get a number, like on Telegram. On a phone, tap your picture and choose Notifications.", target: () => document.querySelector<HTMLElement>(isPhone() ? '[data-tour="account"]' : '[data-tour="bell"]') },
  { title: "Your picture is your account", body: "Tap it for your profile, your subscription and receipts, and to get the app on your phone.", target: () => document.querySelector<HTMLElement>('[data-tour="account"]') },
  { title: "Never miss a call", body: "Add the app to your home screen and turn on notifications. You will find both under Get the App in your picture menu." },
];

type Pos = { ring: { top: number; left: number; width: number; height: number } | null; bubble: { top: number; left: number; arrow: "up" | "left" | "none"; arrowX: number } };

function place(step: Step): Pos {
  const el = step.target?.() ?? null;
  const W = window.innerWidth, H = window.innerHeight, bw = Math.min(320, W - 24);
  if (!el) return { ring: null, bubble: { top: Math.max(24, H / 2 - 110), left: (W - bw) / 2, arrow: "none", arrowX: 0 } };
  const r = el.getBoundingClientRect();
  const ring = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
  if (r.height > H * 0.5 && r.right < W / 2) return { ring, bubble: { top: r.top + 24, left: r.right + 18, arrow: "left", arrowX: 0 } };
  const left = Math.min(Math.max(12, r.left + r.width / 2 - bw / 2), W - bw - 12);
  return { ring, bubble: { top: r.bottom + 16, left, arrow: "up", arrowX: Math.min(Math.max(20, r.left + r.width / 2 - left), bw - 20) } };
}

/** A short guided tour with speech bubbles pointing at the real parts of the page. Shows once per tour version, or when asked. */
export function Tour({ show }: { show: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const stepRef = useRef<number | null>(null);

  const go = useCallback((n: number | null) => {
    stepRef.current = n;
    setStep(n);
    setPos(n === null ? null : place(STEPS[n]));
  }, []);

  useEffect(() => {
    const open = () => go(0);
    const onResize = () => { if (stepRef.current !== null) setPos(place(STEPS[stepRef.current])); };
    window.addEventListener("flc:tour", open);
    window.addEventListener("resize", onResize);
    if (show) queueMicrotask(open);
    return () => { window.removeEventListener("flc:tour", open); window.removeEventListener("resize", onResize); };
  }, [show, go]);

  function finish() { go(null); void completeTour(); }
  if (step === null || !pos) return null;
  const s = STEPS[step], last = step === STEPS.length - 1;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {pos.ring ? <div className="tour-ring" style={pos.ring} /> : <div className="tour-dim" />}
      <div className={"tour-bubble arrow-" + pos.bubble.arrow} style={{ top: pos.bubble.top, left: pos.bubble.left, ["--ax" as string]: pos.bubble.arrowX + "px" }}>
        <h2 id="tour-title">{s.title}</h2>
        <p>{s.body}</p>
        <div className="tour-actions">
          <button type="button" className="linkbtn" onClick={finish}>{last ? "Close" : "Skip tour"}</button>
          <span className="when">{step + 1} of {STEPS.length}</span>
          {step > 0 ? <button type="button" className="btn small" onClick={() => go(step - 1)}>Back</button> : null}
          <button type="button" className="btn primary small" onClick={() => (last ? finish() : go(step + 1))}>{last ? "Done" : step === 0 ? "Start" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
