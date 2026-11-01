import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { ChatList } from "@/components/chats/ChatList";
import { Composer } from "@/components/chats/Composer";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { SeenReporter } from "@/components/chats/SeenReporter";
import { PinnedPost } from "@/components/chats/PinnedPost";
import { PostCard } from "@/components/chats/PostCard";
import { canSee } from "@/lib/roles";
import { SubmitResource } from "@/components/chats/SubmitResource";
import { requireMember } from "@/lib/auth/guards";
import { mySubmissions } from "@/lib/resources/queries";
import { getChat, listPosts } from "@/lib/chats/queries";
import { loadSidebar } from "@/lib/chats/sidebar";
import { attachReaders } from "@/lib/chats/receipts";
import { MarkRead } from "@/components/conversation/MarkRead";
import { listConversation } from "@/lib/chats/conversation";
import { ConversationView } from "@/components/conversation/ConversationView";

export const instant = false;
const PAGE = 30;

export async function generateMetadata(props: PageProps<"/chats/[slug]">) {
  const { slug } = await props.params;
  return { title: `Chat: ${slug.replace(/-/g, " ")}` };
}

export default async function ChatPage(props: PageProps<"/chats/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!supabase) notFound();
  const chat = await getChat(supabase, slug);
  if (!chat) notFound();
  const role = session.profile.role;
  const side = await loadSidebar(supabase);
  const sections = side.sections;
  if (!canSee(role, chat.min_role)) {
    return (
      <>
        <div className="chats">
          <div className="chats-head"><PageHeading>{chat.name}</PageHeading></div>
          <ChatList sections={sections} current={slug} role={role} muted={side.muted} unread={side.unread} groups={side.groups} />
          <section className="card-s" style={{ maxWidth: 520 }}>
            <h2 className="qh" style={{ marginTop: 0 }}>This chat is for affiliates</h2>
            <p style={{ margin: 0 }}>It unlocks when you join the Free Life Collective as an affiliate. Until then, you are welcome in the New Members chats.</p>
          </section>
        </div>
      </>
    );
  }
  const limit = Math.min(300, Math.max(PAGE, Number(Array.isArray(sp.limit) ? sp.limit[0] : sp.limit) || PAGE));
  if (chat.mode === "conversation") {
    const { messages, more } = await listConversation(supabase, chat, session.user.id, session.profile.role === "admin", limit);
    await attachReaders(supabase, "chat", chat.id, messages);
    const admin = session.profile.role === "admin";
    return (
      <div className="chats">
        <div className="chats-head"><PageHeading ledeClass="chat-lede" lede={(role === "lead" ? chat.description_lead : null) ?? chat.description ?? undefined}>{chat.name}</PageHeading></div>
        <ChatList sections={sections} current={slug} role={role} muted={side.muted} unread={side.unread} groups={side.groups} />
        <div className="chat-main">
          <LiveRefresh />
          <MarkRead kind="chat" groupId={chat.id} lastId={messages[messages.length - 1]?.id ?? null} unread={side.unread[chat.id] ?? 0} />
          {slug === "resources" ? <SubmitResource userId={session.user.id} name={[session.profile.first_name, session.profile.last_name].filter(Boolean).join(" ")} avatarUrl={session.profile.avatar_url} initials={((session.profile.first_name ?? "").charAt(0) + (session.profile.last_name ?? "").charAt(0)).toUpperCase()} mine={await mySubmissions(supabase)} /> : null}
          <ConversationView me={session.user.id} messages={messages} kind="chat" targetId={chat.id} slug={slug} canPost={chat.posting === "all" || admin} placeholder="Write a message…" basePath={`/chats/${slug}`} canPin={admin} jumpTo={typeof sp.jump === "string" ? sp.jump : undefined} moreHref={more ? `/chats/${slug}?limit=${limit + PAGE}` : undefined} nowIso={new Date().toISOString()} readOnlyText="Only admins can post here." />
        </div>
      </div>
    );
  }
  const [{ posts, more }, { posts: pinned }] = await Promise.all([
    listPosts(supabase, chat, session.user.id, limit),
    listPosts(supabase, chat, session.user.id, limit, true),
  ]);
  const isAdmin = session.profile.role === "admin";

  return (
    <>
      <div className="chats">
        <div className="chats-head"><PageHeading ledeClass="chat-lede" lede={(role === "lead" ? chat.description_lead : null) ?? chat.description ?? undefined}>{chat.name}</PageHeading></div>
        <ChatList sections={sections} current={slug} role={role} muted={side.muted} unread={side.unread} groups={side.groups} />
        <div className="chat-main">
          <LiveRefresh />
          <MarkRead kind="chat" groupId={chat.id} lastId={posts[0]?.id ?? null} unread={side.unread[chat.id] ?? 0} />
          {slug === "resources" ? <SubmitResource userId={session.user.id} name={[session.profile.first_name, session.profile.last_name].filter(Boolean).join(" ")} avatarUrl={session.profile.avatar_url} initials={((session.profile.first_name ?? "").charAt(0) + (session.profile.last_name ?? "").charAt(0)).toUpperCase()} mine={await mySubmissions(supabase)} /> : null}
          {chat.posting === "all" || isAdmin ? <Composer chatId={chat.id} slug={slug} placeholder={chat.votes_on ? "Suggest how to respond…" : "Write a post…"} /> : <p className="when" style={{ margin: 0 }}>Only admins can post here. You can react to updates.</p>}
          {chat.show_views ? <SeenReporter ids={[...pinned, ...posts].map((p) => p.id)} /> : null}
          {pinned.map((p) => <PinnedPost key={p.id} post={p} slug={slug} voting={chat.votes_on} isAdmin={isAdmin} canReply={chat.replies_allowed || isAdmin} showViews={chat.show_views} />)}
          {posts.length === 0 && pinned.length === 0 ? <p className="page-lede">Nothing here yet. Be the first to post!</p> : null}
          {posts.map((p) => <PostCard key={p.id} post={p} slug={slug} voting={chat.votes_on} isAdmin={isAdmin} canReply={chat.replies_allowed || isAdmin} showViews={chat.show_views} />)}
          {more ? <p><a className="btn" href={`/chats/${slug}?limit=${limit + PAGE}`}>Show older posts</a></p> : null}
        </div>
      </div>
    </>
  );
}
