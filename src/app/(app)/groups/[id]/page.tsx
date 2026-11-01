import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { ConversationView } from "@/components/conversation/ConversationView";
import { GroupSettings, type GroupMember } from "@/components/conversation/GroupSettings";
import { MarkRead } from "@/components/conversation/MarkRead";
import { requireMember } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import type { Msg } from "@/lib/chats/messages";
import type { Author } from "@/lib/chats/types";

export const instant = false;
const PAGE = 60;

export const metadata = { title: "Private Group" };

export default async function GroupPage(props: PageProps<"/groups/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = session.user.id;
  const { data: group } = await supabase.from("group_chats").select("id, name").eq("id", id).maybeSingle();
  if (!group) notFound();
  const limit = Math.min(300, Math.max(PAGE, Number(Array.isArray(sp.limit) ? sp.limit[0] : sp.limit) || PAGE));
  const [{ data: mem }, { data: rows }] = await Promise.all([
    supabase.from("group_members").select("user_id, role").eq("group_id", id),
    supabase.from("group_messages").select("id, author_id, body, reply_to, created_at").eq("group_id", id).order("created_at", { ascending: false }).limit(limit + 1),
  ]);
  const members = (mem ?? []) as { user_id: string; role: string }[];
  const all = (rows ?? []) as { id: string; author_id: string | null; body: string; reply_to: string | null; created_at: string }[];
  const more = all.length > limit;
  const page = all.slice(0, limit).reverse();
  const authors = await authorsById(supabase, [...members.map((m) => m.user_id), ...page.map((m) => m.author_id).filter((x): x is string => !!x)]);
  const who = (uid: string | null): Author => (uid && authors.get(uid)) || { id: uid ?? "", name: "Former member", username: null, avatar_url: null, is_admin: false };
  const byId = new Map(page.map((m) => [m.id, m]));
  const isOwner = members.some((m) => m.user_id === me && m.role === "owner");
  const messages: Msg[] = page.map((m) => {
    const q = m.reply_to ? byId.get(m.reply_to) : null;
    return { id: m.id, author: who(m.author_id), body: m.body, created_at: m.created_at, mine: m.author_id === me, canDelete: m.author_id === me || isOwner, replyTo: q ? { id: q.id, name: who(q.author_id).name, body: q.body } : null };
  });
  const list: GroupMember[] = members.map((m) => ({ id: m.user_id, name: who(m.user_id).name, avatar_url: who(m.user_id).avatar_url, owner: m.role === "owner" }));
  return (
    <div className="grp">
      <LiveRefresh tables={["group_messages", "group_members"]} />
      <MarkRead groupId={id} lastId={messages[messages.length - 1]?.id ?? null} />
      <div className="grp-head">
        <PageHeading lede={<Link href="/groups">← All groups</Link>}>{group.name}</PageHeading>
        <GroupSettings groupId={id} name={group.name} members={list} me={me} isOwner={isOwner} />
      </div>
      <ConversationView messages={messages} kind="group" targetId={id} canPost placeholder="Write a message…" moreHref={more ? `/groups/${id}?limit=${limit + PAGE}` : undefined} nowIso={new Date().toISOString()} />
    </div>
  );
}
