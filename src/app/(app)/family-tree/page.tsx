import { redirect } from "next/navigation";
import { FamilyTree } from "@/components/tree/FamilyTree";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import type { TreeNode } from "@/lib/tree/layout";

export const instant = false;
export const metadata = { title: "Your Organization" };

export default async function FamilyTreePage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  if (!supabase) return <><PageHeading>Your Organization</PageHeading><p className="page-lede">This needs the database.</p></>;
  const [{ data: nodes }, { data: tree }, { data: mp }] = await Promise.all([
    supabase.from("family_tree_nodes").select("id, parent_id, side, label, rank, linked_member_id, owned").eq("owner_id", session.user.id).order("created_at"),
    supabase.from("family_trees").select("share_token, root_label, root_rank").eq("owner_id", session.user.id).maybeSingle(),
    supabase.from("member_private").select("rank_id").maybeSingle(),
  ]);
  const rankId = (mp as { rank_id: number | null } | null)?.rank_id ?? null;
  const ranks = ["1A", "2A", "3A", "4A", "5A", "6A", "6A2-3+"];
  const t = tree as { share_token: string | null; root_label: string | null; root_rank: string | null } | null;
  const p = session.profile;
  const name = t?.root_label || [p.first_name, p.last_name].filter(Boolean).join(" ") || "You";
  return (
    <>
      <PageHeading lede="Map out your current organization or use this feature to vision-board your way to higher ranks. Add as many accounts as you like, change it any time, and keep both sides stacked evenly.">Your Organization</PageHeading>
      <FamilyTree initial={(nodes ?? []) as TreeNode[]} ownerName={name} ownerRank={t?.root_rank || (rankId ? ranks[rankId - 1] ?? null : null)} token={t?.share_token ?? null} rootEdited={!!t?.root_label} />
    </>
  );
}
