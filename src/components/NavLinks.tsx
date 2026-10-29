"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { LiveDot } from "./LiveBadge";

export type NavEntry = { label: string; href?: string; heading?: boolean; group?: string; badge?: number; live?: boolean };

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
 * "Onboarding" is a plain labelled section that is always open. "Admin only" folds away until you open it.
 */
export function NavLinks({ items }: { items: NavEntry[] }) {
  const path = usePathname();
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const on = (n: NavEntry) => !!n.href && (n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/"));
  const isOpen = (label: string) => label === "Onboarding" || (manual[label] ?? items.some((g) => g.group === label && !g.heading && on(g)));
  const waiting = (label: string) => items.filter((g) => g.group === label && !g.heading).reduce((n, g) => n + (g.badge ?? 0), 0);

  return (
    <ul>
      {items.map((n, idx) => {
        if (n.heading && n.label === "Onboarding") {
          return <li key={n.label} className="nav-group" data-nav={n.label}><span className="nav-toggle nav-static">{n.label}</span></li>;
        }
        if (n.heading) {
          const open = isOpen(n.label);
          const w = waiting(n.label);
          return (
            <li key={n.label} className="nav-group" data-nav={n.label}>
              <button type="button" className="nav-toggle" aria-expanded={open} onClick={() => setManual({ ...manual, [n.label]: !open })}>
                <span>{n.label}</span>
                <span className="nav-toggle-right">
                  {!open && w ? <span className="badge" aria-label={`${w} waiting`}>{w}</span> : null}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
                </span>
              </button>
            </li>
          );
        }
        if (n.group && !isOpen(n.group)) return null;
        /* a line closes the Onboarding section, matching the one under Home */
        const closesOnboarding = !n.group && !n.heading && items[idx - 1]?.group === "Onboarding";
        return closesOnboarding ? <Fragment key={n.label}><li className="nav-rule" aria-hidden="true" /><Item n={n} path={path} /></Fragment> : <Item key={n.label} n={n} path={path} />;
      })}
    </ul>
  );
}
