import Link from "next/link";
import type { ReactNode } from "react";
import { canSee, type Role } from "@/lib/roles";
import type { AppSession } from "@/lib/profile/types";
import { Avatar } from "./Avatar";

type NavItem = { label: string; href?: string; min: Role };

/** Only Home exists so far. The rest appear (as "Soon") in the phase that builds them. */
const NAV: NavItem[] = [
  { label: "Home", href: "/", min: "lead" },
  { label: "Calendar", min: "lead" },
  { label: "Channels", min: "lead" },
  { label: "Classroom", min: "lead" },
  { label: "Calls", min: "lead" },
  { label: "Documents", min: "lead" },
  { label: "Accountability Buddy", min: "member" },
  { label: "Commission calculator", min: "member" },
  { label: "Graphic maker", min: "member" },
];

export function AppShell({ session, children }: { session: AppSession; children: ReactNode }) {
  const p = session.profile;
  const initials = ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";
  return (
    <div className="app">
      <header className="app-top">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>Free Life Collective</Link>
        <div className="search" role="search">
          <input type="search" disabled placeholder="Search (coming soon)" aria-label="Search the portal (coming soon)" />
        </div>
        <div className="top-right">
          <Avatar url={p.avatar_url} initials={initials} preview={session.mode === "preview"} label={`${p.first_name ?? "Your"} profile picture`} />
          <form action="/logout" method="post"><button className="linkbtn" type="submit" style={{ padding: "8px 4px" }}>Sign out</button></form>
        </div>
      </header>
      <div className="app-body">
        <nav className="nav" aria-label="Main">
          <ul>
            {NAV.filter((n) => canSee(p.role, n.min)).map((n) => (
              <li key={n.label}>
                {n.href ? <Link href={n.href} aria-current="page">{n.label}</Link> : <span>{n.label}<span className="soon">Soon</span></span>}
              </li>
            ))}
          </ul>
        </nav>
        <main className="main" id="main">{children}</main>
      </div>
    </div>
  );
}
