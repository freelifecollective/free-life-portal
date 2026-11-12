import { PageHeading } from "@/components/PageHeading";
import { FunnelTabs } from "@/components/funnels/FunnelTabs";
import { MessagesView, type Msg } from "@/components/funnels/MessagesView";
import { requirePlan } from "@/lib/auth/guards";
import { DEFAULT_MESSAGES } from "@/lib/messages/defaults";

export const instant = false;
export const metadata = { title: "Emails" };

export default async function EmailsPage() {
  const { session, supabase } = await requirePlan(97);
  const { data } = await supabase.from("member_messages").select("id, kind, name, subject, body, default_key").eq("owner_id", session.user.id).order("updated_at", { ascending: false });
  return (
    <>
      <PageHeading lede="The emails and texts your automations send. Start from a ready-made one or write your own.">Emails</PageHeading>
      <FunnelTabs current="/advertising/funnels/emails" />
      <MessagesView messages={(data ?? []) as Msg[]} defaults={DEFAULT_MESSAGES} />
    </>
  );
}
