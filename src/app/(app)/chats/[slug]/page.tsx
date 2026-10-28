import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { ChatList } from "@/components/chats/ChatList";
import { Composer } from "@/components/chats/Composer";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { PinnedPost } from "@/components/chats/PinnedPost";
import { PostCard } from "@/components/chats/PostCard";
import { canSee } from "@/lib/roles";
import { SubmitResource } from "@/components/chats/SubmitResource";
import { requireMember } from "@/lib/auth/guards";
import { mySubmissions } from "@/lib/resources/queries";
import { getChat, listChatSections, listPosts } from "@/lib/chats/queries";

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
  if (!canSee(role, chat.min_role)) {
    const sections = await listChatSections(supabase);
    return (
      <>
        <div className="chats">
          <div className="chats-head"><PageHeading>{chat.name}</PageHeading></div>
          <ChatList sections={sections} current={slug} role={role} />
          <section className="card-s" style={{ maxWidth: 520 }}>
            <h2 className="qh" style={{ marginTop: 0 }}>This chat is for affiliates</h2>
            <p style={{ margin: 0 }}>It unlocks when you join the Free Life Collective as an affiliate. Until then, you are welcome in the New Members chats.</p>
          </section>
        </div>
      </>
    );
  }
  const limit = Math.min(300, Math.max(PAGE, Number(Array.isArray(sp.limit) ? sp.limit[0] : sp.limit) || PAGE));
  const [sections, { posts, more }, { posts: pinned }] = await Promise.all([
    listChatSections(supabase),
    listPosts(supabase, chat, session.user.id, limit),
    listPosts(supabase, chat, session.user.id, limit, true),
  ]);
  const isAdmin = session.profile.role === "admin";

  return (
    <>
      <div className="chats">
        <div className="chats-head"><PageHeading ledeClass="chat-lede" lede={(role === "lead" ? chat.description_lead : null) ?? chat.description ?? undefined}>{chat.name}</PageHeading></div>
        <ChatList sections={sections} current={slug} role={role} />
        <div className="chat-main">
          <LiveRefresh />
          {slug === "resources" ? <SubmitResource userId={session.user.id} name={[session.profile.first_name, session.profile.last_name].filter(Boolean).join(" ")} avatarUrl={session.profile.avatar_url} initials={((session.profile.first_name ?? "").charAt(0) + (session.profile.last_name ?? "").charAt(0)).toUpperCase()} mine={await mySubmissions(supabase)} /> : null}
          <Composer chatId={chat.id} slug={slug} placeholder={chat.votes_on ? "Suggest how to respond…" : "Write a post…"} />
          {pinned.map((p) => <PinnedPost key={p.id} post={p} slug={slug} voting={chat.votes_on} isAdmin={isAdmin} />)}
          {posts.length === 0 && pinned.length === 0 ? <p className="page-lede">Nothing here yet. Be the first to post!</p> : null}
          {posts.map((p) => <PostCard key={p.id} post={p} slug={slug} voting={chat.votes_on} isAdmin={isAdmin} />)}
          {more ? <p><a className="btn" href={`/chats/${slug}?limit=${limit + PAGE}`}>Show older posts</a></p> : null}
        </div>
      </div>
    </>
  );
}
