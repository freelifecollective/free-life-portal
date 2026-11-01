"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { completeTour } from "@/app/(app)/notifications/actions";
import { useMenu } from "@/components/MobileMenu";

type Step = { section: string; title: string; body: string; target?: () => HTMLElement | null; needsMenu?: boolean };
const isPhone = () => window.matchMedia("(max-width: 768px)").matches;
const q = (sel: string) => () => document.querySelector<HTMLElement>(sel);

/** What each tab is for, in plain words. A tab that is not listed still gets a short, generic step. */
const TABS: Record<string, string> = {
  "Home": "Your starting point. See your next call and copy your invite link, then check how your landing page is doing: visits, clicks, form fill-outs and who joined.",
  "Tasks": "Your own to-do list for business and life. Pick how often a task repeats, drag to reorder, and get reminders. Clear your list for the day and we celebrate with you.",
  "Accountability Buddy": "Answer a few questions and we match you with people who will keep you on track. You choose your buddy, and you can pause any time.",
  "Calendar": "Every call, with the date and time. Tap I'll be there live or I'll watch the recording. Times are Eastern, and your own time shows underneath if you are somewhere else.",
  "Calls": "Join live calls from here, and watch replays any time. Filter recordings by topic and year.",
  "Chats": "Talk with the community. New Members chats are open to everyone, and Affiliates Only chats unlock when you join as an affiliate. Important Updates has the latest team news.",
  "Courses": "Courses and lessons, with your progress saved. Coming soon.",
  "Earnings Estimator": "Pick your country and points, then tap products to see what your commissions could be.",
  "Documents": "Guides and resources to download and share, organised in folders.",
  "Financing Options": "Different ways to fund your business, sorted by country. Affiliates can suggest new ones for approval.",
  "Outsourcing": "Find help from other members, or list what you can do for others. See their rates, how many people hired them, and reviews.",
  "Verbiage + Objections": "The answers the community has voted best for replying to leads' questions and objections.",
  "Admin only": "Your admin tools: manage calls, people and invites, review submissions, send announcements, and the activity log where you can undo changes. Open this section to see them.",
};

function buildSteps(): Step[] {
  const base: Step[] = [
    { section: "Getting started", title: "Welcome to the Free Life Collective!", body: "This quick tour shows you how to get set up, then walks through every tab in the menu. You can skip any time, and replay it later from your picture menu." },
    { section: "Getting started", title: "Your picture is your account", body: "Tap your picture for everything about you: your profile, your subscription and receipts, notifications, the app, and logging out.", target: q('[data-tour="account"]') },
    { section: "Getting started", title: "Step 1: finish your profile", body: "Open Profile from this menu to change your picture (the profile generator is in there), add your Instagram and Facebook, and set your username and rank.", target: q('[data-tour="account"]') },
    { section: "Getting started", title: "Step 2: turn on notifications", body: "Open Get the App from this menu, add the app to your home screen, and turn on notifications. You will get new leads, call reminders, messages and updates right on your phone.", target: q('[data-tour="account"]') },
    { section: "Getting started", title: "Your messages", body: "Private messages with anyone in the portal live here. A red number shows what is unread, and the eye lets you peek without sending a Read receipt.", target: q('[data-tour="messages"]') },
  ];
  if (isPhone()) base.push({ section: "Getting started", title: "Search", body: "Search is coming soon. This is where you will find people, chats and documents.", target: q(".search-icon .hdr-btn") });
  else base.push({ section: "Getting started", title: "Search", body: "Search is coming soon. This is where you will find people, chats and documents.", target: q(".search") });
  base.push({ section: "Your menu", title: "Your menu", body: isPhone() ? "Everything else lives in the menu. We will open it now and go through each tab." : "Everything else lives in the menu on the left. Here is each tab, one by one.", target: isPhone() ? q(".menu-btn") : q("#main-nav") });
  const tabs: Step[] = [...document.querySelectorAll<HTMLElement>("#main-nav [data-nav]")].map((li) => {
    const label = li.dataset.nav ?? "";
    return { section: "Your menu", title: label, body: TABS[label] ?? "Part of the portal. More is arriving step by step.", target: () => document.querySelector<HTMLElement>(`#main-nav [data-nav="${CSS.escape(label)}"]`), needsMenu: true };
  });
  const end: Step = { section: "All set", title: "That's the tour!", body: "You can replay it any time from your picture menu under Take the tour. Welcome to the family." };
  return [...base, ...tabs, end];
}

type Pos = { ring: { top: number; left: number; width: number; height: number } | null; bubble: { top: number; left: number; arrow: "up" | "down" | "left" | "none"; arrowX: number } };
const BUBBLE_H = 230;

function place(step: Step): Pos {
  const el = step.target?.() ?? null;
  const W = window.innerWidth, H = window.innerHeight, bw = Math.min(330, W - 24);
  if (!el || el.getBoundingClientRect().width === 0) return { ring: null, bubble: { top: Math.max(24, H / 2 - 120), left: (W - bw) / 2, arrow: "none", arrowX: 0 } };
  el.scrollIntoView({ block: "nearest" });
  const r = el.getBoundingClientRect();
  const ring = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
  const inNav = !!el.closest("#main-nav");
  if (inNav && !isPhone()) return { ring, bubble: { top: Math.min(Math.max(12, r.top - 8), H - BUBBLE_H - 12), left: Math.max(r.right, 224) + 22, arrow: "left", arrowX: 0 } };
  const left = Math.min(Math.max(12, r.left + r.width / 2 - bw / 2), W - bw - 12);
  const arrowX = Math.min(Math.max(20, r.left + r.width / 2 - left), bw - 20);
  if (r.bottom + 16 + BUBBLE_H > H && r.top - 16 - BUBBLE_H > 0) return { ring, bubble: { top: r.top - 16 - BUBBLE_H, left, arrow: "down", arrowX } };
  return { ring, bubble: { top: r.bottom + 16, left, arrow: "up", arrowX } };
}

/** A guided tour with speech bubbles: first how to get set up, then every tab in the menu. Shows once per tour version, or when asked. */
export function Tour({ show }: { show: boolean }) {
  const menu = useMenu();
  const [step, setStep] = useState<number | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [list, setList] = useState<Step[]>([]);
  const steps = useRef<Step[]>([]);
  const cur = useRef<number | null>(null);
  const menuRef = useRef(menu);
  useEffect(() => { menuRef.current = menu; });

  const go = useCallback((n: number | null) => {
    cur.current = n;
    setStep(n);
    if (n === null) { setPos(null); if (isPhone()) menuRef.current.close(); return; }
    const s = steps.current[n];
    if (isPhone()) { if (s.needsMenu || s.title === "Your menu") menuRef.current.show(); else menuRef.current.close(); }
    requestAnimationFrame(() => requestAnimationFrame(() => { if (cur.current === n) setPos(place(s)); }));
  }, []);

  useEffect(() => {
    const open = () => { steps.current = buildSteps(); setList(steps.current); go(0); };
    const onResize = () => { if (cur.current !== null) setPos(place(steps.current[cur.current])); };
    window.addEventListener("flc:tour", open);
    window.addEventListener("resize", onResize);
    if (show) queueMicrotask(open);
    return () => { window.removeEventListener("flc:tour", open); window.removeEventListener("resize", onResize); };
  }, [show, go]);

  function finish() { go(null); void completeTour(); }
  if (step === null || !pos) return null;
  const s = list[step], last = step === list.length - 1;
  if (!s) return null;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {pos.ring ? <div className="tour-ring" style={pos.ring} /> : <div className="tour-dim" />}
      <div className={"tour-bubble arrow-" + pos.bubble.arrow} style={{ top: pos.bubble.top, left: pos.bubble.left, ["--ax" as string]: pos.bubble.arrowX + "px" }}>
        <p className="tour-eyebrow">{s.section}</p>
        <h2 id="tour-title">{s.title}</h2>
        <p>{s.body}</p>
        <div className="tour-actions">
          <button type="button" className="linkbtn" onClick={finish}>{last ? "Close" : "Skip tour"}</button>
          <span className="when">{step + 1} of {list.length}</span>
          {step > 0 ? <button type="button" className="btn small" onClick={() => go(step - 1)}>Back</button> : null}
          <button type="button" className="btn primary small" onClick={() => (last ? finish() : go(step + 1))}>{last ? "Done" : step === 0 ? "Start" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
