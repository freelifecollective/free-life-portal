import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { ChatList } from "@/components/chats/ChatList";
import { Composer } from "@/components/chats/Composer";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { PostCard } from "@/components/chats/PostCard";
import { requireMember } from "@/lib/auth/guards";
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
  const limit = Math.min(300, Math.max(PAGE, Number(Array.isArray(sp.limit) ? sp.limit[0] : sp.limit) || PAGE));
  const [sections, { posts, more }] = await Promise.all([listChatSections(supabase), listPosts(supabase, chat, session.user.id, limit)]);
  const isAdmin = session.profile.role === "admin";

  return (
    <>
      <PageHeading lede={chat.description ?? undefined}>{chat.name}</PageHeading>
      <div className="chats">
        <ChatList sections={sections} current={slug} />
        <div className="chat-main">
          <LiveRefresh />
          <Composer chatId={chat.id} slug={slug} placeholder={chat.votes_on ? "Suggest how to respond…" : "Write a post…"} />
          {posts.length === 0 ? <p className="page-lede">Nothing here yet. Be the first to post!</p> : null}
          {posts.map((p) => <PostCard key={p.id} post={p} slug={slug} voting={chat.votes_on} isAdmin={isAdmin} />)}
          {more ? <p><a className="btn" href={`/chats/${slug}?limit=${limit + PAGE}`}>Show older posts</a></p> : null}
        </div>
      </div>
    </>
  );
}
