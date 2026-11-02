import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { ChatList } from "@/components/chats/ChatList";
import { NewGroup } from "@/components/conversation/NewGroup";
import { requireMember } from "@/lib/auth/guards";
import { loadSidebar } from "@/lib/chats/sidebar";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Group Chats" };

/** Your group chats in one place (and where you make a new one). */
export default async function GroupsPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Group Chats</PageHeading><p className="page-lede">Chats need the database, which preview mode does not have.</p></>;
  const side = await loadSidebar(supabase);
  const role = session.profile.role;
  return (
    <div className="chats">
      <div className="chats-head"><PageHeading lede={isAffiliate(role) ? "Private chats with the people you choose." : "The private chats you have been added to."}>Group Chats</PageHeading></div>
      <ChatList sections={side.sections} current="group:" role={role} muted={side.muted} unread={side.unread} groups={side.groups} />
      <div className="chat-main">
        {side.groups.length === 0 ? (
          <section className="card-s"><p style={{ margin: 0 }}>{isAffiliate(role) ? "You are not in any group chats yet. Make one with the people you want to talk with." : "You have not been added to any group chats yet."}</p>{isAffiliate(role) ? <p style={{ margin: "12px 0 0" }}><NewGroup /></p> : null}</section>
        ) : (
          <ul className="gl-list">
            {side.groups.map((g) => (
              <li key={g.id}>
                <Link href={`/groups/${g.id}`} className="card-s gl-item">
                  <span className="gl-top"><strong translate="no">{g.name}</strong>{g.unread ? <span className="chat-badge" style={{ position: "static" }} aria-label={`${g.unread} unread`}>{g.unread}</span> : null}</span>
                  <span className="when">{`${g.members} ${g.members === 1 ? "member" : "members"}`}</span>
                  {g.last_body ? <span className="gl-last" translate="no">{g.last_author ? `${g.last_author}: ` : ""}{g.last_body}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
