import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { listChatSections } from "@/lib/chats/queries";

export const instant = false;
export const metadata = { title: "Chats" };

export default async function ChatsIndex() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Chats</PageHeading><p className="page-lede">Chats need the database, which preview mode does not have.</p></>;
  const all = (await listChatSections(supabase)).flatMap((s) => s.chats);
  /* Lacey's downline open on their own chat; everyone else on the first one */
  const first = (session.profile.role === "downline" ? all.find((c) => c.slug === "main-discussion") : undefined) ?? all[0];
  if (first) redirect(`/chats/${first.slug}`);
  return <><PageHeading>Chats</PageHeading><p className="page-lede">No chats are available yet.</p></>;
}
