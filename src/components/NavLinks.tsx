"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LiveDot } from "./LiveBadge";

export type NavEntry = { label: string; href?: string; heading?: boolean; badge?: number; live?: boolean };

function Item({ n, path }: { n: NavEntry; path: string }) {
  if (!n.href) return <li data-nav={n.label}><span>{n.label}<span className="soon">Soon</span></span></li>;
  const active = n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/");
  return (
    <li data-nav={n.label}>
      <Link href={n.href} aria-current={active ? "page" : undefined}>{n.label}{n.live ? <LiveDot /> : null}{n.badge ? <span className="badge" aria-label={`${n.badge} waiting`}>{n.badge}</span> : null}</Link>
    </li>
  );
}

/**
 * The left-hand menu. The page you are on is highlighted; pages that do not exist yet say "Soon".
 * A heading (like "Admin only") folds away everything under it until you open it.
 */
export function NavLinks({ items }: { items: NavEntry[] }) {
  const path = usePathname();
  const [manual, setManual] = useState<boolean | null>(null);
  const cut = items.findIndex((n) => n.heading);
  const main = cut === -1 ? items : items.slice(0, cut);
  const heading = cut === -1 ? null : items[cut];
  const group = cut === -1 ? [] : items.slice(cut + 1);
  const inGroup = group.some((g) => g.href && (path === g.href || path.startsWith(g.href + "/")));
  const open = manual ?? inGroup;
  const waiting = group.reduce((n, g) => n + (g.badge ?? 0), 0);

  return (
    <ul>
      {main.map((n) => <Item key={n.label} n={n} path={path} />)}
      {heading ? (
        <>
          <li className="nav-group" data-nav={heading.label}>
            <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="nav-group-items" onClick={() => setManual(!open)}>
              <span>{heading.label}</span>
              <span className="nav-toggle-right">
                {!open && waiting ? <span className="badge" aria-label={`${waiting} waiting`}>{waiting}</span> : null}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </button>
          </li>
          {open ? group.map((n) => <Item key={n.label} n={n} path={path} />) : null}
        </>
      ) : null}
    </ul>
  );
}
