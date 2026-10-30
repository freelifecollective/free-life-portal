"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useSyncExternalStore } from "react";
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

/** The gentle line with a small sparkle in the middle that separates the menu's sections. */
function Divider() {
  return <li className="nav-divider" aria-hidden="true"><span /><i>✦</i><span /></li>;
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
  const sectioned = new Set(items.filter((g) => g.heading).map((g) => g.label));

  return (
    <ul>
      {items.map((n, idx) => {
        if (n.heading) {
          const opened = isOpen(n.label);
          const w = waiting(n.label);
          return (
            <Fragment key={n.label}>
              <Divider />
              <li className="nav-group" data-nav={n.label}>
                <button type="button" className="nav-toggle" aria-expanded={opened} onClick={() => remember(isOpen(n.label) ? NONE : n.label)}>
                  <span>{n.label}</span>
                  <span className="nav-toggle-right">
                    {!opened && w ? <span className="badge" aria-label={`${w} waiting`}>{w}</span> : null}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: opened ? "rotate(180deg)" : undefined, transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </button>
              </li>
            </Fragment>
          );
        }
        if (n.group && !isOpen(n.group)) return null;
        /* a sparkle line closes a section, matching the ones above the headings */
        const closesSection = !n.group && sectioned.has(items[idx - 1]?.group ?? "");
        return closesSection ? <Fragment key={n.label}><Divider /><Item n={n} path={path} /></Fragment> : <Item key={n.label} n={n} path={path} />;
      })}
    </ul>
  );
}
