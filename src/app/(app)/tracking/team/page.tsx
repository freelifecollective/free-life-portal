import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { TeamView } from "@/components/tracking/TeamView";
import { requireMember } from "@/lib/auth/guards";
import { loadTeam } from "@/lib/tracking/queries";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "My Team" };

export default async function MyTeamPage(props: PageProps<"/tracking/team">) {
  const sp = await props.searchParams;
  const open = Array.isArray(sp.open) ? sp.open[0] : sp.open;
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  if (!supabase) return <><PageHeading>My Team</PageHeading><p className="page-lede">This needs the database.</p></>;
  const [team, { data: g }] = await Promise.all([
    loadTeam(supabase),
    supabase.from("group_chats").select("id").eq("created_by", session.user.id).ilike("name", "%team%").order("created_at").limit(1),
  ]);
  const teamChat = (g as { id: string }[] | null)?.[0]?.id ? `/groups/${(g as { id: string }[])[0].id}` : null;
  return (
    <>
      <PageHeading lede="Everyone on your team, A to Z. Open a name for their check-in list, and see who is active, who has left, and when you last checked in.">My Team</PageHeading>
      <PlacedDocs placement="team" />
      <TeamView initial={team} openId={open && /^[0-9a-f-]{36}$/i.test(open) ? open : undefined} teamChat={teamChat} />
    </>
  );
}
