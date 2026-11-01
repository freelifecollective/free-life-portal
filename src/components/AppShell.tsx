import Link from "next/link";
import type { ReactNode } from "react";
import { NotificationBell } from "./notifications/NotificationBell";
import { Tour } from "./notifications/Tour";
import { BuddyReminder } from "./buddy/BuddyDialog";
import { WaterPrompt } from "./water/WaterShareDialog";
import { FeedbackPrompt, type PendingCall } from "./calls/FeedbackPrompt";
import { MenuButton, MenuProvider, NavPanel } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { canSee, type Role } from "@/lib/roles";
import type { AppSession } from "@/lib/profile/types";
import { SearchIcon } from "./SearchIcon";
import { MessageDock } from "./messages/MessageDock";
import { LanguagePicker } from "./LanguagePicker";
import { PresenceBeat } from "./PresenceBeat";
import { RankCelebration } from "./RankCelebration";
import { UserMenu } from "./UserMenu";
import { ProfilePopupProvider } from "./people/ProfilePopup";

type NavItem = { label: string; href?: string; min: Role; admin?: boolean; heading?: boolean; group?: string };

/** Items without a link are built in a later phase and show as "Soon". */
const NAV: NavItem[] = [
  { label: "Home", href: "/", min: "lead" },
  { label: "Calendar", href: "/calendar", min: "lead", group: "FLC Calls" },
  { label: "Outsourcing", href: "/outsourcing", min: "member" },
  { label: "Financing Options", href: "/financing", min: "lead", group: "Placing Sales" },
  { label: "Chats", href: "/chats", min: "lead" },
  { label: "Verbiage + Objections", href: "/responses", min: "member", group: "Placing Sales" },
  { label: "Classroom", min: "lead" },
  { label: "Calls", href: "/calls", min: "lead", group: "FLC Calls" },
  { label: "FLC Calls", min: "lead", heading: true, group: "FLC Calls" },
  { label: "Documents", href: "/documents", min: "lead" },
  { label: "Onboarding", min: "member", heading: true, group: "Onboarding" },
  { label: "Accountability Buddy", href: "/buddy", min: "member", group: "Onboarding" },
  { label: "Earnings Estimator", href: "/calculator", min: "member", group: "Placing Sales" },
  { label: "Graphic maker", min: "member" },
  { label: "Your Organization", href: "/family-tree", min: "member", group: "Placing Sales" },
  { label: "Tasks", href: "/tasks", min: "member" },
  { label: "Water Share Map", href: "/water-map", min: "member" },
  { label: "Call Closers for Hire", href: "/call-closers", min: "member", group: "Placing Sales" },
  { label: "Facebook Follows", href: "/facebook-follows", min: "member", group: "Onboarding" },
  { label: "Placing Sales", min: "lead", heading: true, group: "Placing Sales" },
  { label: "Admin only", min: "admin", admin: true, heading: true, group: "Admin only" },
  { label: "Activity log", href: "/admin/activity", min: "admin", admin: true, group: "Admin only" },
  { label: "Announcements", href: "/admin/announcements", min: "admin", admin: true, group: "Admin only" },
  { label: "Members by country", href: "/admin/countries", min: "admin", admin: true, group: "Admin only" },
  { label: "Call closer applications", href: "/admin/closer-applications", min: "admin", admin: true, group: "Admin only" },
  { label: "Manage calls", href: "/admin/calls", min: "admin", admin: true, group: "Admin only" },
  { label: "Manage recordings", href: "/admin/recordings", min: "admin", admin: true, group: "Admin only" },
  { label: "Resource submissions", href: "/admin/resources", min: "admin", admin: true, group: "Admin only" },
  { label: "Financing submissions", href: "/admin/financing", min: "admin", admin: true, group: "Admin only" },
  { label: "People and invites", href: "/admin/people", min: "admin", admin: true, group: "Admin only" },
  { label: "Update Documents", href: "/admin/documents", min: "admin", admin: true, group: "Admin only" },
];

/** Home and Chats first, then the "FLC Calls", "Onboarding" and "Placing Sales" sections, then everything else A to Z. The admin section stays at the bottom, also A to Z. */
function ordered(items: NavItem[]): NavItem[] {
  const az = (a: NavItem, b: NavItem) => a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  const top = ["Home", "Chats"].flatMap((l) => items.filter((n) => n.label === l));
  const onboarding = items.filter((n) => n.group === "Onboarding");
  const sales = items.filter((n) => n.group === "Placing Sales");
  const calls = items.filter((n) => n.group === "FLC Calls");
  const rest = items.filter((n) => n.label !== "Home" && n.label !== "Chats" && !n.admin && !n.group).sort(az);
  const admin = items.filter((n) => n.admin);
  const sections = (g: NavItem[]) => (g.some((n) => !n.heading) ? [...g.filter((n) => n.heading), ...g.filter((n) => !n.heading).sort(az)] : []);
  return [...top, ...sections(calls), ...sections(onboarding), ...sections(sales), ...rest, ...sections(admin)];
}

export function AppShell({ session, badges = {}, unread = 0, showTour = false, buddyRemind = null, pendingFeedback = [], liveNow = false, waterPrompt = false, children }: { session: AppSession; badges?: Record<string, number>; unread?: number; showTour?: boolean; buddyRemind?: string | null; pendingFeedback?: PendingCall[]; liveNow?: boolean; waterPrompt?: boolean; children: ReactNode }) {
  const p = session.profile;
  const initials = ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";
  return (
    <MenuProvider>
    <ProfilePopupProvider>
    <div className="app">
      <header className="app-top">
        <MenuButton />
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/icons/icon-192.png" alt="" width={34} height={34} />
          Free Life Collective
        </Link>
        <div className="top-main">
        <div className="search" role="search">
          <input type="search" disabled placeholder="Search (coming soon)" aria-label="Search the portal (coming soon)" />
        </div>
        <div className="top-right">
          <SearchIcon />
          <LanguagePicker />
{session.mode === "supabase" ? <MessageDock me={session.user.id} unread={badges["/messages"] ?? 0} /> : (
            <Link href="/messages" className="hdr-btn" data-tour="messages" aria-label="Messages">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </Link>
          )}
          {session.mode === "supabase" ? <span className="desk-only"><NotificationBell count={unread} userId={session.user.id} /></span> : null}
          <UserMenu unread={unread} showNotifications={session.mode === "supabase"} url={p.avatar_url} initials={initials} preview={session.mode === "preview"} label={`${p.first_name ?? "Your"} profile picture`} showSubscription={p.role !== "lead"} />
        </div>
        </div>
      </header>
      <div className="app-body">
        <NavPanel>
          <NavLinks items={ordered(NAV.filter((n) => canSee(p.role, n.min))).map(({ label, href, heading, group }) => ({ label, href, heading, group, badge: href ? badges[href] : undefined, live: liveNow && href === "/calls" }))} />
        </NavPanel>
        <main className="main" id="main">{children}</main>
      </div>
    </div>
    <Tour show={showTour} />
    {buddyRemind ? <BuddyReminder rank={buddyRemind} /> : null}
    {waterPrompt ? <WaterPrompt /> : null}
    <RankCelebration />
    {session.mode === "supabase" ? <PresenceBeat /> : null}
    {pendingFeedback.length ? <FeedbackPrompt calls={pendingFeedback} /> : null}
    </ProfilePopupProvider>
    </MenuProvider>
  );
}
