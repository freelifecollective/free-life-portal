"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavEntry = { label: string; href?: string; heading?: boolean; badge?: number };

/** The left-hand menu. The page you are on is highlighted; pages that do not exist yet say "Soon". */
export function NavLinks({ items }: { items: NavEntry[] }) {
  const path = usePathname();
  return (
    <ul>
      {items.map((n) => {
        if (n.heading) return <li key={n.label} className="nav-heading" aria-hidden="true">{n.label}</li>;
        if (!n.href) return <li key={n.label}><span>{n.label}<span className="soon">Soon</span></span></li>;
        const active = n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/");
        return <li key={n.label}><Link href={n.href} aria-current={active ? "page" : undefined}>{n.label}{n.badge ? <span className="badge" aria-label={`${n.badge} waiting`}>{n.badge}</span> : null}</Link></li>;
      })}
    </ul>
  );
}
