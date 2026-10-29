import Link from "next/link";
import type { ReactNode } from "react";
import { NotificationBell } from "./notifications/NotificationBell";
import { Tour } from "./notifications/Tour";
import { BuddyReminder } from "./buddy/BuddyDialog";
import { MenuButton, MenuProvider, NavPanel } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { canSee, type Role } from "@/lib/roles";
import type { AppSession } from "@/lib/profile/types";
import { SearchIcon } from "./SearchIcon";
import { UserMenu } from "./UserMenu";

type NavItem = { label: string; href?: string; min: Role; admin?: boolean; heading?: boolean };

/** Items without a link are built in a later phase and show as "Soon". */
const NAV: NavItem[] = [
  { label: "Home", href: "/", min: "lead" },
  { label: "Calendar", href: "/calendar", min: "lead" },
  { label: "Outsourcing", href: "/outsourcing", min: "member" },
  { label: "Financing Options", href: "/financing", min: "lead" },
  { label: "Chats", href: "/chats", min: "lead" },
  { label: "Verbiage + Objections", href: "/responses", min: "member" },
  { label: "Classroom", min: "lead" },
  { label: "Calls", min: "lead" },
  { label: "Documents", href: "/documents", min: "lead" },
  { label: "Accountability Buddy", href: "/buddy", min: "member" },
  { label: "Commission calculator", href: "/calculator", min: "member" },
  { label: "Graphic maker", min: "member" },
  { label: "Admin only", min: "admin", admin: true, heading: true },
  { label: "Activity log", href: "/admin/activity", min: "admin", admin: true },
  { label: "Announcements", href: "/admin/announcements", min: "admin", admin: true },
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

export function AppShell({ session, badges = {}, unread = 0, showTour = false, buddyRemind = null, children }: { session: AppSession; badges?: Record<string, number>; unread?: number; showTour?: boolean; buddyRemind?: string | null; children: ReactNode }) {
  const p = session.profile;
  const initials = ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";
  return (
    <MenuProvider>
    <div className="app">
      <header className="app-top">
        <MenuButton />
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/icons/icon-192.png" alt="" width={34} height={34} />
          Free Life Collective
        </Link>
        <div className="search" role="search">
          <input type="search" disabled placeholder="Search (coming soon)" aria-label="Search the portal (coming soon)" />
        </div>
        <div className="top-right">
          <SearchIcon />
          <Link href="/messages" className="hdr-btn" data-tour="messages" aria-label={badges["/messages"] ? `Messages, ${badges["/messages"]} unread` : "Messages"}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {badges["/messages"] ? <span className="badge bell-badge" aria-hidden="true">{badges["/messages"] > 99 ? "99+" : badges["/messages"]}</span> : null}
          </Link>
          {session.mode === "supabase" ? <span className="desk-only"><NotificationBell count={unread} userId={session.user.id} /></span> : null}
          <UserMenu unread={unread} showNotifications={session.mode === "supabase"} url={p.avatar_url} initials={initials} preview={session.mode === "preview"} label={`${p.first_name ?? "Your"} profile picture`} showSubscription={p.role !== "lead"} />
        </div>
      </header>
      <div className="app-body">
        <NavPanel>
          <NavLinks items={ordered(NAV.filter((n) => canSee(p.role, n.min))).map(({ label, href, heading }) => ({ label, href, heading, badge: href ? badges[href] : undefined }))} />
        </NavPanel>
        <main className="main" id="main">{children}</main>
      </div>
    </div>
    <Tour show={showTour} />
    {buddyRemind ? <BuddyReminder rank={buddyRemind} /> : null}
    </MenuProvider>
  );
}
