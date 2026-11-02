import Link from "next/link";
import { canSee, isAffiliate, type Role } from "@/lib/roles";
import { MemberList } from "./MemberList";
import { MuteMenu, MutedIcon } from "@/components/mute/MuteMenu";
import { SearchAll } from "./SearchAll";
import { NewGroup } from "@/components/conversation/NewGroup";
import type { ChatSection } from "@/lib/chats/types";
import type { GroupRow } from "@/lib/chats/sidebar";

const Badge = ({ n }: { n?: number }) => (n ? <span className="chat-badge" aria-label={`${n} unread`}>{n > 99 ? "99+" : n}</span> : null);

function Lock() {
  return (
    <svg className="lock" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const kindOf = (n: string) => { const k = n.trim().toLowerCase(); return k === "affiliates only" ? "affiliates" as const : k === "new members" ? "leads" as const : null; };

/**
 * The chats, as two rows of tabs across the top: first the sections (New Members, Affiliates Only, Lacey's Downline, Group Chats),
 * then the chats inside the section you are in. The conversation gets the whole width underneath.
 */
export function ChatList({ sections, current, role, muted, unread, groups }: { sections: ChatSection[]; current: string; role: Role; muted?: Set<string>; unread?: Record<string, number>; groups?: GroupRow[] }) {
  const showGroups = !!groups && (isAffiliate(role) || groups.length > 0);
  /* the section you are in follows the chat you opened */
  const inGroups = current.startsWith("group:");
  const active = inGroups ? "groups" : String(sections.find((s) => s.chats.some((c) => c.slug === current))?.id ?? sections[0]?.id ?? (showGroups ? "groups" : ""));
  const waiting = (s: ChatSection) => s.chats.reduce((n, c) => n + (unread?.[c.id] ?? 0), 0);
  const groupWaiting = (groups ?? []).reduce((n, g) => n + (g.unread ?? 0), 0);
  const here = sections.find((s) => String(s.id) === active);

  return (
    <nav className="chat-list chat-bar" aria-label="Chats">
      <div className="chat-bar-top">
        <ul className="chat-tabs" aria-label="Sections">
          {sections.map((s) => {
            const locked = !canSee(role, s.min_role);
            const first = s.chats[0];
            return (
              <li key={s.id}>
                <Link href={first ? `/chats/${first.slug}` : "/chats"} className={"chat-tab" + (String(s.id) === active ? " on" : "") + (locked ? " locked" : "")} aria-current={String(s.id) === active ? "true" : undefined}>
                  {s.name}{locked ? <Lock /> : null}{String(s.id) !== active ? <Badge n={waiting(s) || undefined} /> : null}
                </Link>
              </li>
            );
          })}
          {showGroups ? (
            <li>
              <Link href={groups![0] ? `/groups/${groups![0].id}` : "/groups"} className={"chat-tab" + (active === "groups" ? " on" : "")} aria-current={active === "groups" ? "true" : undefined}>
                Group Chats{active !== "groups" ? <Badge n={groupWaiting || undefined} /> : null}
              </Link>
            </li>
          ) : null}
        </ul>
        <SearchAll />
      </div>

      <div className="chat-bar-row">
        {here ? (
          <ul className="chat-pills" aria-label={here.name}>
            {here.chats.map((c) => {
              const open = canSee(role, c.min_role);
              const isMuted = !!muted?.has(`chat:${c.id}`);
              return (
                <li key={c.id}>
                  {open
                    ? <MuteMenu kind="chat" id={c.id} muted={isMuted}><Link href={`/chats/${c.slug}`} className="chat-pill" aria-current={c.slug === current ? "page" : undefined}>{c.name}{isMuted ? <MutedIcon /> : null}<Badge n={unread?.[c.id]} /></Link></MuteMenu>
                    : <Link href={`/chats/${c.slug}`} className="chat-pill chat-locked" aria-current={c.slug === current ? "page" : undefined}>{c.name}<Lock /><span className="sr-only"> (locked)</span></Link>}
                </li>
              );
            })}
          </ul>
        ) : null}
        {active === "groups" && groups ? (
          <ul className="chat-pills" aria-label="Group Chats">
            {groups.map((g) => (
              <li key={g.id}>
                <MuteMenu kind="group" id={g.id} muted={!!muted?.has(`group:${g.id}`)}>
                  <Link href={`/groups/${g.id}`} className="chat-pill" aria-current={current === `group:${g.id}` ? "page" : undefined}>{g.name}{muted?.has(`group:${g.id}`) ? <MutedIcon /> : null}<Badge n={g.unread} /></Link>
                </MuteMenu>
              </li>
            ))}
            {groups.length === 0 ? <li className="when">No groups yet.</li> : null}
            {isAffiliate(role) ? <li><NewGroup /></li> : null}
          </ul>
        ) : null}
        {here && !canSee(role, here.min_role) ? null : here && kindOf(here.name) && isAffiliate(role)
          ? <span className="chat-members"><MemberList kind={kindOf(here.name)!} title={kindOf(here.name) === "affiliates" ? "FLC Members" : "New Members"} canMessage>{kindOf(here.name) === "affiliates" ? "See FLC Members" : "See New Members"}</MemberList></span>
          : null}
      </div>
    </nav>
  );
}
