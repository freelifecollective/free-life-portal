import { PageHeading } from "@/components/PageHeading";
import { FollowsBoard, type Listing } from "@/components/follows/FollowsBoard";
import { requireMember } from "@/lib/auth/guards";

export const instant = false; // depends on who is signed in
export const metadata = { title: "Facebook Follows" };

export default async function FacebookFollowsPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Facebook Follows</PageHeading><p className="page-lede">This needs the database, which preview mode does not have.</p></>;
  const { data } = await supabase.rpc("fb_follow_list");
  return (
    <>
      <PageHeading lede="Help new members reach their first 50 Facebook follows. Follow their page, then tap “I followed”. Once a page reaches 50, it comes off the list.">Facebook Follows</PageHeading>
      <FollowsBoard listings={(data ?? []) as Listing[]} isAdmin={session.profile.role === "admin"} canList={session.profile.role !== "lead"} suggested={session.profile.facebook ?? ""} />
    </>
  );
}
