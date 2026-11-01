"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { TREE_RANKS } from "@/lib/tree/colors";
import type { TreeNode } from "@/lib/tree/layout";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANKS: string[] = [...TREE_RANKS];
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type NodeInput = { id?: string; chartId: string; parentId: string | null; side: "left" | "right"; label: string; rank: string; linkedId: string | null; owned: boolean };

/** Adds a bubble (no id) or changes the name, rank or linked member of an existing one. */
export async function saveNode(input: NodeInput): Promise<Result<{ node: TreeNode }>> {
  const label = String(input.label ?? "").trim();
  if (!label || label.length > 60) return { ok: false, error: "Enter a name or account name (up to 60 characters)." };
  const rank = input.rank ? String(input.rank) : null;
  if (rank && !RANKS.includes(rank)) return { ok: false, error: "Choose a rank from the list." };
  if (input.side !== "left" && input.side !== "right") return { ok: false, error: "Something went wrong." };
  if (!UUID.test(input.chartId ?? "")) return { ok: false, error: "Something went wrong." };
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
  /* "add to the left" puts the new account before the others under that bubble, "add to the right" after them */
  let createdAt: string | undefined;
  if (input.side === "left") {
    const sibs = supabase.from("family_tree_nodes").select("created_at").eq("chart_id", input.chartId).order("created_at").limit(1);
    const { data: first } = await (input.parentId ? sibs.eq("parent_id", input.parentId) : sibs.is("parent_id", null)).maybeSingle();
    const t = (first as { created_at: string } | null)?.created_at;
    if (t) createdAt = new Date(new Date(t).getTime() - 1000).toISOString();
  }
  const { data, error } = await supabase.from("family_tree_nodes").insert({ owner_id: session.user.id, chart_id: input.chartId, parent_id: input.parentId, side: input.side, label, rank, linked_member_id: linked, owned, ...(createdAt ? { created_at: createdAt } : {}) }).select(cols).maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "That spot is already taken. Refresh and try again." };
    if (error?.code === "23514") return { ok: false, error: "A chart can hold up to 600 bubbles." };
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
export async function setSharing(chartId: string, on: boolean): Promise<Result<{ token: string | null }>> {
  if (!UUID.test(chartId)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { data, error } = await supabase.rpc("set_chart_sharing", { p_chart: chartId, p_on: on });
  if (error) return { ok: false, error: "We could not change sharing. Please try again." };
  return { ok: true, token: (data as string | null) ?? null };
}

/** Changes the top bubble's name and rank. Empty means use your profile name and rank. */
export async function saveRoot(chartId: string, label: string, rank: string): Promise<Result> {
  if (!UUID.test(chartId)) return { ok: false, error: "Something went wrong." };
  const l = String(label ?? "").trim();
  const r = rank ? String(rank) : "";
  if (l.length > 60) return { ok: false, error: "Enter a name or account name (up to 60 characters)." };
  if (r && !RANKS.includes(r)) return { ok: false, error: "Choose a rank from the list." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const { error } = await supabase.rpc("save_chart_root", { p_chart: chartId, p_label: l, p_rank: r });
  if (error) return { ok: false, error: "We could not save that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}

/** Moves an account, with everything under it, to another account, the top box or an empty spot. */
export async function moveNode(id: string, parentId: string | null, side: "left" | "right", place?: { first?: boolean; after?: string }): Promise<Result> {
  if (!UUID.test(id) || (parentId && !UUID.test(parentId)) || (side !== "left" && side !== "right") || (place?.after && !UUID.test(place.after))) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const { error } = await supabase.rpc("move_tree_node", { p_id: id, p_parent: parentId, p_side: side, p_after: place?.after ?? null, p_first: !!place?.first });
  if (error) return { ok: false, error: error.code === "23514" ? "A bubble cannot go under itself or anything below it." : "We could not move that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}

/** A new chart: empty, or a copy of one you already have. */
export async function createChart(name: string, copyOf: string | null): Promise<Result<{ id: string }>> {
  const n = String(name ?? "").trim();
  if (!n || n.length > 60) return { ok: false, error: "Give the chart a name of up to 60 characters." };
  if (copyOf && !UUID.test(copyOf)) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const { data, error } = await supabase.rpc("create_chart", { p_name: n, p_copy_of: copyOf });
  if (error || !data) return { ok: false, error: "We could not make that chart. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true, id: data as string };
}

export async function renameChart(chartId: string, name: string): Promise<Result> {
  const n = String(name ?? "").trim();
  if (!UUID.test(chartId) || !n || n.length > 60) return { ok: false, error: "Give the chart a name of up to 60 characters." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("rename_chart", { p_chart: chartId, p_name: n });
  if (error) return { ok: false, error: "We could not rename that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}

export async function deleteChart(chartId: string): Promise<Result> {
  if (!UUID.test(chartId)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { error } = await supabase.rpc("delete_chart", { p_chart: chartId });
  if (error) return { ok: false, error: error.code === "23514" ? "Keep at least one chart." : "We could not delete that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}

/** Copies an account (and, if asked, everything under it) into another chart, under that chart's top bubble. */
/** Copy the top bubble of this chart into another chart (alone, or with everything under it). */
export async function copyTop(chartId: string, destId: string, side: "left" | "right", below: boolean): Promise<Result> {
  if (!UUID.test(chartId) || !UUID.test(destId) || (side !== "left" && side !== "right")) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const { error } = await supabase.rpc("copy_chart_top", { p_src: chartId, p_dest: destId, p_side: side, p_below: below });
  if (error) return { ok: false, error: error.code === "23514" ? "That chart is full (600 bubbles)." : "We could not copy that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}

export async function copyNode(id: string, chartId: string, side: "left" | "right", below: boolean): Promise<Result> {
  if (!UUID.test(id) || !UUID.test(chartId) || (side !== "left" && side !== "right")) return { ok: false, error: "Something went wrong." };
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return { ok: false, error: "Your Organization is for affiliates." };
  const { error } = await supabase.rpc("copy_tree_nodes", { p_id: id, p_chart: chartId, p_parent: null, p_side: side, p_below: below });
  if (error) return { ok: false, error: error.code === "23514" ? "That chart is full (600 bubbles)." : "We could not copy that. Please try again." };
  revalidatePath("/family-tree");
  return { ok: true };
}
