"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LiveDot } from "./LiveBadge";

export type NavEntry = { label: string; href?: string; heading?: boolean; group?: string; badge?: number; live?: boolean };

/* Only one section is open at a time. Each device remembers which one (or "none"), under its own key. */
const KEY = "flc_nav_open";
const NONE = "none";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; /* storage may be blocked */ } };
function remember(value: string) {
  try { localStorage.setItem(KEY, value); } catch { /* not saved, still works this visit */ }
  listeners.forEach((l) => l());
}

function Item({ n, path }: { n: NavEntry; path: string }) {
  if (!n.href) return <li data-nav={n.label} className={n.group ? "nav-sub" : undefined}><span>{n.label}<span className="soon">Soon</span></span></li>;
  const active = n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/");
  return (
    <li data-nav={n.label} className={n.group ? "nav-sub" : undefined}>
      <Link href={n.href} aria-current={active ? "page" : undefined}>{n.label}{n.live ? <LiveDot /> : null}{n.badge ? <span className="badge" aria-label={`${n.badge} waiting`}>{n.badge}</span> : null}</Link>
    </li>
  );
}

/**
 * The left-hand menu. The page you are on is highlighted; pages that do not exist yet say "Soon".
 * Every section heading folds its tabs away. Only one section is open at a time, and the choice is remembered on this device.
 */
export function NavLinks({ items }: { items: NavEntry[] }) {
  const path = usePathname();
  const saved = useSyncExternalStore(subscribe, read, () => "");
  const on = (n: NavEntry) => !!n.href && (n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/"));
  const sections = items.filter((g) => g.heading).map((g) => g.label);
  /* until someone chooses, the section holding the page they are on is open, otherwise the first one */
  const open = saved && (saved === NONE || sections.includes(saved)) ? saved : sections.find((l) => items.some((g) => g.group === l && !g.heading && on(g))) ?? sections[0] ?? NONE;
  const isOpen = (label: string) => open === label;
  const waiting = (label: string) => items.filter((g) => g.group === label && !g.heading).reduce((n, g) => n + (g.badge ?? 0), 0);

  /* Home and Chats first, then each section with its tabs, then the tabs that are not in a section */
  const section = (label: string) => {
    const opened = isOpen(label);
    const w = waiting(label);
    const kids = items.filter((g) => g.group === label && !g.heading);
    return (
      <li key={label} className={"nav-section" + (opened ? " open" : "")} data-nav={label}>
        <button type="button" className="nav-toggle" aria-expanded={opened} onClick={() => remember(opened ? NONE : label)}>
          <span>{label}</span>
          <span className="nav-toggle-right">
            {!opened && w ? <span className="badge" aria-label={`${w} waiting`}>{w}</span> : null}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: opened ? "rotate(180deg)" : undefined, transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </button>
        {opened ? <ul className="nav-kids">{kids.map((n) => <Item key={n.label} n={n} path={path} />)}</ul> : null}
      </li>
    );
  };

  return (
    <ul>
      {items.map((n) => (n.heading ? section(n.label) : n.group ? null : <Item key={n.label} n={n} path={path} />))}
    </ul>
  );
}
