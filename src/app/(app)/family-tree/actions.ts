"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import type { TreeNode } from "@/lib/tree/layout";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANKS = ["1A", "2A", "3A", "4A", "5A", "6A", "6A2", "6A2-2", "6A2-3+"];
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type NodeInput = { id?: string; parentId: string | null; side: "left" | "right"; label: string; rank: string; linkedId: string | null; owned: boolean };

/** Adds a bubble (no id) or changes the name, rank or linked member of an existing one. */
export async function saveNode(input: NodeInput): Promise<Result<{ node: TreeNode }>> {
  const label = String(input.label ?? "").trim();
  if (!label || label.length > 60) return { ok: false, error: "Enter a name or account name (up to 60 characters)." };
  const rank = input.rank ? String(input.rank) : null;
  if (rank && !RANKS.includes(rank)) return { ok: false, error: "Choose a rank from the list." };
  if (input.side !== "left" && input.side !== "right") return { ok: false, error: "Something went wrong." };
  if (input.parentId && !UUID.test(input.parentId)) return { ok: false, error: "Something went wrong." };
  const linked = input.linkedId && UUID.test(input.linkedId) ? input.linkedId : null;
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const cols = "id, parent_id, side, label, rank, linked_member_id, owned";
  const owned = input.owned === true;
  if (input.id) {
    if (!UUID.test(input.id)) return { ok: false, error: "Something went wrong." };
    const { data, error } = await supabase.from("family_tree_nodes").update({ label, rank, linked_member_id: linked, owned }).eq("id", input.id).select(cols).maybeSingle();
    if (error || !data) return { ok: false, error: "We could not save that. Please try again." };
    revalidatePath("/family-tree");
    return { ok: true, node: data as TreeNode };
  }
  const { data, error } = await supabase.from("family_tree_nodes").insert({ owner_id: session.user.id, parent_id: input.parentId, side: input.side, label, rank, linked_member_id: linked, owned }).select(cols).maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "That spot is already taken. Refresh and try again." };
    if (error?.code === "23514") return { ok: false, error: "A tree can hold up to 600 bubbles." };
    return { ok: false, error: "We could not save that. Please try again." };
  }
  revalidatePath("/family-tree");
  return { ok: true, node: data as TreeNode };
}

/** Removes a bubble and everything under it. */
export async function removeNode(id: string): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.from("family_tree_nodes").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not remove that." };
  revalidatePath("/family-tree");
  return { ok: true };
}

/** Turns the share link on (returns the token) or off. */
export async function setSharing(on: boolean): Promise<Result<{ token: string | null }>> {
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { data, error } = await supabase.rpc("set_tree_sharing", { p_on: on });
  if (error) return { ok: false, error: "We could not change sharing. Please try again." };
  return { ok: true, token: (data as string | null) ?? null };
}

/** Changes the top bubble's name and rank. Empty means use your profile name and rank. */
export async function saveRoot(label: string, rank: string): Promise<Result> {
  const l = String(label ?? "").trim();
  const r = rank ? String(rank) : "";
  if (l.length > 60) return { ok: false, error: "Enter a name or account name (up to 60 characters)." };
  if (r && !RANKS.includes(r)) return { ok: false, error: "Choose a rank from the list." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const { error } = await supabase.rpc("save_tree_root", { p_label: l, p_rank: r });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}

/** Moves an account, with everything under it, to another account, the top box or an empty spot. */
export async function moveNode(id: string, parentId: string | null, side: "left" | "right"): Promise<Result> {
  if (!UUID.test(id) || (parentId && !UUID.test(parentId)) || (side !== "left" && side !== "right")) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const { error } = await supabase.rpc("move_tree_node", { p_id: id, p_parent: parentId, p_side: side });
  if (error) return { ok: false, error: error.code === "23514" ? "A bubble cannot go under itself or anything below it." : "We could not move that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}
