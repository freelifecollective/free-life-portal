import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { NewGroup } from "@/components/conversation/NewGroup";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Private Groups" };

type Row = { id: string; name: string; members: number; unread: number; last_body: string | null; last_author: string | null; is_owner: boolean };

export default async function GroupsPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) notFound();
  const isLead = session.profile.role === "lead";
  const { data } = await supabase.rpc("group_overview");
  const groups = (data ?? []) as Row[];
  return (
    <div className="grp">
      <LiveRefresh tables={["group_messages", "group_members"]} />
      <div className="grp-head">
        <PageHeading lede="Private conversations with the people you choose.">Private Groups</PageHeading>
        {!isLead ? <NewGroup /> : null}
      </div>
      {groups.length === 0 ? <p className="page-lede">{isLead ? "You will see the groups you are added to here." : "No groups yet. Tap New group to start one."}</p> : null}
      <div className="grp-list">
        {groups.map((g) => (
          <Link key={g.id} href={`/groups/${g.id}`} className="grp-item">
            <strong>{g.name}</strong>
            <span className="when">{g.members} members</span>
            <span className="when">{g.last_body ? `${g.last_author ? g.last_author + ": " : ""}${g.last_body.slice(0, 80)}` : "No messages yet"}</span>
            {g.unread > 0 ? <span className="grp-bar" aria-label={`${g.unread} unread`}>{g.unread}</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
