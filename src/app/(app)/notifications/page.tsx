import { PageHeading } from "@/components/PageHeading";
import { NotificationList, type Item } from "@/components/notifications/NotificationList";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Notifications</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.from("notifications").select("id, kind, title, body, url, created_at, read_at").order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <PageHeading lede="Anything that happens outside the chats shows up here.">Notifications</PageHeading>
      <NotificationList items={(data ?? []) as Item[]} />
    </>
  );
}
