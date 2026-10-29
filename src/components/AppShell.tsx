import Link from "next/link";
import type { ReactNode } from "react";
import { MenuButton, MenuProvider, NavPanel } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { canSee, type Role } from "@/lib/roles";
import type { AppSession } from "@/lib/profile/types";
import { UserMenu } from "./UserMenu";

type NavItem = { label: string; href?: string; min: Role; admin?: boolean; heading?: boolean };

/** Items without a link are built in a later phase and show as "Soon". */
const NAV: NavItem[] = [
  { label: "Home", href: "/", min: "lead" },
  { label: "Calendar", href: "/calendar", min: "lead" },
  { label: "Financing Options", href: "/financing", min: "lead" },
  { label: "Chats", href: "/chats", min: "lead" },
  { label: "Verbiage + Objections", href: "/responses", min: "member" },
  { label: "Classroom", min: "lead" },
  { label: "Calls", min: "lead" },
  { label: "Documents", min: "lead" },
  { label: "Accountability Buddy", min: "member" },
  { label: "Commission calculator", min: "member" },
  { label: "Graphic maker", min: "member" },
  { label: "Admin only", min: "admin", admin: true, heading: true },
  { label: "Manage calls", href: "/admin/calls", min: "admin", admin: true },
  { label: "Resource submissions", href: "/admin/resources", min: "admin", admin: true },
  { label: "Financing submissions", href: "/admin/financing", min: "admin", admin: true },
  { label: "People and invites", href: "/admin/people", min: "admin", admin: true },
];

/** Home first, then everything else A to Z. The admin section stays at the bottom, also A to Z. */
function ordered(items: NavItem[]): NavItem[] {
  const az = (a: NavItem, b: NavItem) => a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  const home = items.filter((n) => n.label === "Home");
  const rest = items.filter((n) => n.label !== "Home" && !n.admin).sort(az);
  const admin = items.filter((n) => n.admin);
  return [...home, ...rest, ...admin.filter((n) => n.heading), ...admin.filter((n) => !n.heading).sort(az)];
}

export function AppShell({ session, badges = {}, children }: { session: AppSession; badges?: Record<string, number>; children: ReactNode }) {
  const p = session.profile;
  const initials = ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";
  return (
    <MenuProvider>
    <div className="app">
      <header className="app-top">
        <MenuButton />
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>Free Life Collective</Link>
        <div className="search" role="search">
          <input type="search" disabled placeholder="Search (coming soon)" aria-label="Search the portal (coming soon)" />
        </div>
        <div className="top-right">
          <UserMenu url={p.avatar_url} initials={initials} preview={session.mode === "preview"} label={`${p.first_name ?? "Your"} profile picture`} />
        </div>
      </header>
      <div className="app-body">
        <NavPanel>
          <NavLinks items={ordered(NAV.filter((n) => canSee(p.role, n.min))).map(({ label, href, heading }) => ({ label, href, heading, badge: href ? badges[href] : undefined }))} />
        </NavPanel>
        <main className="main" id="main">{children}</main>
      </div>
    </div>
    </MenuProvider>
  );
}
