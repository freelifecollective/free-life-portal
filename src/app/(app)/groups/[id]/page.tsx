import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { ChatList } from "@/components/chats/ChatList";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { ConversationView } from "@/components/conversation/ConversationView";
import { GroupSettings, type GroupMember } from "@/components/conversation/GroupSettings";
import { MarkRead } from "@/components/conversation/MarkRead";
import { requireMember } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import { attachReaders } from "@/lib/chats/receipts";
import { loadSidebar } from "@/lib/chats/sidebar";
import type { Msg } from "@/lib/chats/messages";
import type { Author } from "@/lib/chats/types";

export const instant = false;
const PAGE = 60;

export const metadata = { title: "Group Chat" };

export default async function GroupPage(props: PageProps<"/groups/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = session.user.id;
  const { data: group } = await supabase.from("group_chats").select("id, name").eq("id", id).maybeSingle();
  if (!group) notFound();
  const limit = Math.min(300, Math.max(PAGE, Number(Array.isArray(sp.limit) ? sp.limit[0] : sp.limit) || PAGE));
  const gq = (cols: string) => supabase.from("group_messages").select(cols).eq("group_id", id).order("created_at", { ascending: false }).limit(limit + 1);
  const [side, { data: mem }, first] = await Promise.all([
    loadSidebar(supabase),
    supabase.from("group_members").select("user_id, role").eq("group_id", id),
    gq("id, author_id, body, reply_to, created_at, image_url"),
  ]);
  const rows = first.error ? (await gq("id, author_id, body, reply_to, created_at")).data : first.data;   /* before the GIF update has been run */
  const members = (mem ?? []) as { user_id: string; role: string }[];
  const all = (rows ?? []) as unknown as { id: string; author_id: string | null; body: string; reply_to: string | null; created_at: string; image_url: string | null }[];
  const more = all.length > limit;
  const page = all.slice(0, limit).reverse();
  const authors = await authorsById(supabase, [...members.map((m) => m.user_id), ...page.map((m) => m.author_id).filter((x): x is string => !!x)]);
  const who = (uid: string | null): Author => (uid && authors.get(uid)) || { id: uid ?? "", name: "Former member", username: null, avatar_url: null, is_admin: false };
  const byId = new Map(page.map((m) => [m.id, m]));
  const isOwner = members.some((m) => m.user_id === me && m.role === "owner");
  const messages: Msg[] = page.map((m) => {
    const q = m.reply_to ? byId.get(m.reply_to) : null;
    return { id: m.id, author: who(m.author_id), body: m.body, image_url: m.image_url, created_at: m.created_at, mine: m.author_id === me, canDelete: m.author_id === me || isOwner, replyTo: q ? { id: q.id, name: who(q.author_id).name, body: q.body } : null };
  });
  await attachReaders(supabase, "group", id, messages);
  const list: GroupMember[] = members.map((m) => ({ id: m.user_id, name: who(m.user_id).name, avatar_url: who(m.user_id).avatar_url, owner: m.role === "owner" }));
  const unread = side.groups.find((g) => g.id === id)?.unread ?? 0;
  return (
    <div className="chats">
      <div className="chats-head">
        <PageHeading>{group.name}</PageHeading>
        <GroupSettings groupId={id} name={group.name} members={list} me={me} isOwner={isOwner} />
      </div>
      <ChatList sections={side.sections} current={`group:${id}`} role={session.profile.role} muted={side.muted} unread={side.unread} groups={side.groups} />
      <div className="chat-main">
        <LiveRefresh tables={["group_messages", "group_members"]} />
        <MarkRead groupId={id} lastId={messages[messages.length - 1]?.id ?? null} unread={unread} />
        <ConversationView messages={messages} kind="group" targetId={id} canPost placeholder="Write a message…" moreHref={more ? `/groups/${id}?limit=${limit + PAGE}` : undefined} nowIso={new Date().toISOString()} />
      </div>
    </div>
  );
}
