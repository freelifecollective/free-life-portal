import { PageHeading } from "@/components/PageHeading";
import { ConversationList } from "@/components/messages/ConversationList";
import { NewMessage } from "@/components/messages/NewMessage";
import { LiveRefresh } from "@/components/chats/LiveRefresh";
import { requireMember } from "@/lib/auth/guards";
import { listConversations, messageablePeople } from "@/lib/messages/queries";

export const instant = false;
export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Messages</PageHeading><p className="page-lede">Messages need the database.</p></>;
  const [convos, people] = await Promise.all([listConversations(supabase, session.user.id), messageablePeople(supabase)]);
  return (
    <>
      <PageHeading lede="Use the eye to peek at a message without the sender seeing a Read receipt.">Messages</PageHeading>
      <LiveRefresh tables={["direct_messages"]} />
      <div className="settings" style={{ maxWidth: 720 }}>
        <NewMessage people={people} />
        <ConversationList items={convos} me={session.user.id} />
      </div>
    </>
  );
}
