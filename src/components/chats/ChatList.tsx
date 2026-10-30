import Link from "next/link";
import { Fragment } from "react";
import { canSee, type Role } from "@/lib/roles";
import { MemberList } from "./MemberList";
import type { ChatSection } from "@/lib/chats/types";

function Lock() {
  return (
    <svg className="lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const kindOf = (n: string) => { const k = n.trim().toLowerCase(); return k === "affiliates only" ? "affiliates" as const : k === "new members" ? "leads" as const : null; };

/** Sections with bold headings, each listing its chats. Chats you cannot open yet are faded with a lock. */
export function ChatList({ sections, current, role }: { sections: ChatSection[]; current: string; role: Role }) {
  return (
    <nav className="chat-list" aria-label="Chats">
      {sections.map((s) => {
        const locked = !canSee(role, s.min_role);
        return (
          <section key={s.id} className={locked ? "locked" : undefined}>
            {!locked && role !== "lead" && kindOf(s.name)
              ? <MemberList kind={kindOf(s.name)!} title={kindOf(s.name) === "affiliates" ? "FLC Members" : "New Members"} canMessage>{s.name}</MemberList>
              : <h2 className="chat-section">{s.name}{locked ? <Lock /> : null}</h2>}
            <ul>
              {s.chats.map((c) => (
                <Fragment key={c.id}>
                <li>
                  {canSee(role, c.min_role)
                    ? <Link href={`/chats/${c.slug}`} aria-current={c.slug === current ? "page" : undefined}>{c.name}</Link>
                    : <Link href={`/chats/${c.slug}`} className="chat-locked" aria-current={c.slug === current ? "page" : undefined}>{c.name}<Lock /><span className="sr-only"> (locked)</span></Link>}
                </li>
                {c.divider_after ? <li className="chat-divider" aria-hidden="true"><span /><i>✦</i><span /></li> : null}
                </Fragment>
              ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
