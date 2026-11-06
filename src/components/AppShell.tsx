import { BirthdayBanner } from "@/components/birthday/BirthdayBanner";
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
import { isAffiliate } from "@/lib/roles";

type NavItem = { label: string; href?: string; min: Role; admin?: boolean; heading?: boolean; group?: string; leadOnly?: boolean; closerOnly?: boolean; downline?: boolean; downlineOnly?: boolean; caption?: boolean };

/** Items without a link are built in a later phase and show as "Soon". */
const NAV: NavItem[] = [
  { label: "Home", href: "/", min: "lead", downline: true },
  { label: "Choose Your Plan", href: "/plans", min: "downline", downline: true, downlineOnly: true },
  { label: "Calendar", href: "/calendar", min: "lead", downline: true, group: "FLC Calls" },
  { label: "Outsourcing", href: "/outsourcing", min: "member", group: "DMO" },
  { label: "Financing Options", href: "/financing", min: "lead", group: "Placing Sales" },
  { label: "Chats", href: "/chats", min: "lead", downline: true },
  { label: "Weekly Focus", href: "/support", min: "member", group: "DMO" },
  { label: "Verbiage + Objections", href: "/responses", min: "member", group: "Placing Sales" },
  { label: "Courses", href: "/classroom", min: "member", group: "Courses" },
  { label: "Business Launch Course", href: "/business-launch", min: "member", group: "Courses" },
  { label: "Courses", min: "member", heading: true, group: "Courses" },
  { label: "Calls", href: "/calls", min: "lead", downline: true, group: "FLC Calls" },
  { label: "FLC Calls", min: "lead", downline: true, heading: true, group: "FLC Calls" },
  { label: "Onboarding", min: "member", heading: true, group: "Onboarding" },
  { label: "Accountability Buddy", href: "/buddy", min: "member", group: "Onboarding" },
  { label: "Earnings Estimator", href: "/calculator", min: "member", group: "Placing Sales" },
  { label: "Create a Quote", href: "/create-quote", min: "member", group: "Placing Sales" },
  { label: "Graphic Maker", href: "/graphic-maker", min: "member", group: "Onboarding" },
  { label: "Your Organization", href: "/family-tree", min: "member", group: "Placing Sales" },
  { label: "Tasks", href: "/tasks", min: "member", group: "DMO" },
  { label: "DMO", min: "member", heading: true, group: "DMO" },
  { label: "Book a Call", href: "/book", min: "lead", leadOnly: true },
  { label: "Learn More", href: "/learn-more", min: "lead", leadOnly: true },
  { label: "Water Share Map", href: "/water-map", min: "member", downline: true, group: "Resources" },
  { label: "Call Closers for Hire", href: "/call-closers", min: "member", group: "Placing Sales" },
  { label: "Facebook Follows", href: "/facebook-follows", min: "member", group: "Onboarding" },
  { label: "Placing Sales", min: "member", heading: true, group: "Placing Sales" },
  { label: "Tracking", min: "member", heading: true, group: "Tracking" },
  { label: "Lead Tracking", href: "/tracking/leads", min: "member", group: "Tracking" },
  { label: "Know Your Numbers", href: "/tracking/numbers", min: "member", group: "Tracking" },
  { label: "My Team", href: "/tracking/team", min: "member", group: "Tracking" },
  { label: "Resources", min: "member", downline: true, heading: true, group: "Resources" },
  { label: "Books", href: "/resources/books", min: "member", group: "Resources" },
  { label: "Product Information", href: "/resources/product-information", min: "member", group: "Resources" },
  { label: "Advertising", min: "member", heading: true, group: "Advertising" },
  { label: "Pictures/Videos", href: "/advertising/pictures-videos", min: "member", group: "Advertising" },
  { label: "Canva Templates", href: "/advertising/canva-templates", min: "member", group: "Advertising" },
  { label: "Evidence Manual", href: "/advertising/evidence-manual", min: "member", group: "Advertising" },
  { label: "Landing Page", href: "/advertising/landing-page", min: "member", group: "Advertising" },
  { label: "Admin Only", min: "admin", admin: true, caption: true },
  { label: "Members and Leads", min: "admin", admin: true, heading: true, group: "Members and Leads" },
  { label: "Members, Leads and Invites", href: "/admin/people", min: "admin", admin: true, group: "Members and Leads" },
  { label: "Calls and Courses", min: "admin", admin: true, heading: true, group: "Calls and Courses" },
  { label: "Manage Calls", href: "/admin/calls", min: "admin", admin: true, group: "Calls and Courses" },
  { label: "Manage Recordings", href: "/admin/recordings", min: "admin", admin: true, group: "Calls and Courses" },
  { label: "Manage Courses", href: "/admin/classroom", min: "admin", admin: true, group: "Calls and Courses" },
  { label: "Library", min: "admin", admin: true, heading: true, group: "Library" },
  { label: "Manage Documents", href: "/admin/documents", min: "admin", admin: true, group: "Library" },
  { label: "Manage Graphics", href: "/admin/graphics", min: "admin", admin: true, group: "Library" },
  { label: "Manage Resources", href: "/admin/resource-library", min: "admin", admin: true, group: "Library" },
  { label: "Manage Canva Templates", href: "/admin/canva-templates", min: "admin", admin: true, group: "Library" },
  { label: "Manage Evidence Manual", href: "/admin/evidence", min: "admin", admin: true, group: "Library" },
  { label: "Approvals", min: "admin", admin: true, heading: true, group: "Approvals" },
  { label: "Call Closer Applications", href: "/admin/closer-applications", min: "admin", admin: true, group: "Approvals" },
  { label: "Resource Submissions", href: "/admin/resources", min: "admin", admin: true, group: "Approvals" },
  { label: "Financing Submissions", href: "/admin/financing", min: "admin", admin: true, group: "Approvals" },
  { label: "Emails and Activity", min: "admin", admin: true, heading: true, group: "Emails and Activity" },
  { label: "Emails", href: "/admin/emails", min: "admin", admin: true, group: "Emails and Activity" },
  { label: "Activity Log", href: "/admin/activity", min: "admin", admin: true, group: "Emails and Activity" },
];

/** Home, Chats and the Onboarding section stay at the top. Everything else (sections and single tabs together) is A to Z, and the tabs inside each section are A to Z too. The admin section stays at the bottom, also A to Z. */
function ordered(items: NavItem[], downline = false): NavItem[] {
  const az = (a: NavItem, b: NavItem) => a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  /* Lacey's downline: Choose Your Plan, Calendar, Calls and the Water Share Map sit right under Chats */
  const topLabels = downline ? ["Home", "Chats", "Choose Your Plan", "Calendar", "Calls", "Water Share Map"] : ["Home", "Chats"];
  const top = topLabels.flatMap((l) => items.filter((n) => n.label === l));
  /* a section is its heading followed by its tabs A to Z (a section with no tabs for this person is left out) */
  const section = (label: string, admin: boolean): NavItem[] => {
    const head = items.find((n) => n.heading && n.label === label && !!n.admin === admin);
    const kids = items.filter((n) => !n.heading && n.group === label && !!n.admin === admin).sort(az);
    return head && kids.length ? [head, ...kids] : [];
  };
  const blocks = (admin: boolean, skip: string[]) => {
    const heads = items.filter((n) => n.heading && !!n.admin === admin && !skip.includes(n.label)).map((n) => section(n.label, admin));
    const loose = items.filter((n) => !n.heading && !n.caption && !n.group && !!n.admin === admin && !topLabels.includes(n.label)).map((n) => [n]);
    return [...heads, ...loose].filter((b) => b.length > 0).sort((x, y) => az(x[0], y[0])).flat();
  };
  const caption = items.filter((n) => n.caption);
  const adminBlocks = blocks(true, []);
  return [...top, ...section("Onboarding", false), ...blocks(false, ["Onboarding"]), ...(adminBlocks.length ? [...caption, ...adminBlocks] : caption)];
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
          <span className="brand-full">Free Life Collective</span><span className="brand-short" data-i18n="skip" translate="no">FLC</span>
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
          {session.mode === "supabase" ? <NotificationBell count={unread} userId={session.user.id} /> : null}
          <UserMenu url={p.avatar_url} initials={initials} preview={session.mode === "preview"} label={`${p.first_name ?? "Your"} profile picture`} showSubscription={isAffiliate(p.role)} showCloser={!!p.call_closer} />
        </div>
        </div>
      </header>
      <div className="app-body">
        <NavPanel>
          <NavLinks items={ordered(NAV.filter((n) => p.role === "downline" ? !n.admin && !n.leadOnly && !n.closerOnly : canSee(p.role, n.min) && !n.downlineOnly && (!n.leadOnly || p.role === "lead") && (!n.closerOnly || !!p.call_closer)), p.role === "downline").map((n) => {
            const downline = p.role === "downline";
            /* leads see Financing Options on its own, right under Book a Call; the downline sees Calendar, Calls and the Water Share Map on their own too */
            const alone = (p.role === "lead" && n.label === "Financing Options") || (downline && ["Calendar", "Calls", "Water Share Map"].includes(n.label));
            return { label: n.label, href: n.href, heading: n.heading, group: alone ? undefined : n.group, caption: n.caption, locked: downline && !n.heading && !n.caption && !n.downline && !canSee(p.role, n.min), badge: n.href ? badges[n.href] : undefined, live: liveNow && n.href === "/calls" };
          })} />
        </NavPanel>
        <main className="main" id="main">{session.mode === "supabase" && isAffiliate(p.role) ? <BirthdayBanner /> : null}{children}</main>
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
