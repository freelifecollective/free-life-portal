import { PersonLink } from "@/components/people/ProfilePopup";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { CloseAccountNotice } from "@/components/messages/CloseAccountNotice";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { ReadMarker } from "@/components/messages/ReadMarker";
import { Thread } from "@/components/messages/Thread";
import { requireMember } from "@/lib/auth/guards";
import { fullName, getThread, personByUsername } from "@/lib/messages/queries";

export const instant = false;
export const metadata = { title: "Messages" };

export default async function ConversationPage(props: PageProps<"/messages/[username]">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!supabase) notFound();
  const other = await personByUsername(supabase, username);
  if (!other || other.id === session.user.id) notFound();
  const thread = await getThread(supabase, session.user.id, other.id);
  const unread = thread.some((m) => m.recipient_id === session.user.id && !m.read_at);
  return (
    <>
      <p style={{ margin: "0 0 8px" }}><Link className="linkbtn" href="/messages" style={{ padding: 0 }}>← All messages</Link></p>
      <PageHeading><PersonLink id={other.id} name={fullName(other)}>{fullName(other)}</PersonLink></PageHeading>
      <LiveRefresh tables={["direct_messages"]} />
      {unread ? <ReadMarker otherId={other.id} /> : null}
      {sp.notice === "close" ? <CloseAccountNotice /> : null}
      <div className="settings" style={{ maxWidth: 720 }}>
        <Thread messages={thread} me={session.user.id} />
        <MessageComposer otherId={other.id} draft={sp.draft === "ab" ? "You've been matched as potential AB's!" : ""} />
      </div>
    </>
  );
}
