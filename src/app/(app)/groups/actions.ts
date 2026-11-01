"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 4000;
type R = { ok: true; id?: string } | { ok: false; error: string };
const ids = (xs: string[]) => [...new Set((xs ?? []).filter((x) => UUID.test(x)))].slice(0, 49);

async function db() {
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return null;
  return { me: session.user.id, supabase };
}

export async function createGroup(name: string, members: string[]): Promise<R> {
  const n = String(name ?? "").trim();
  if (!n || n.length > 60) return { ok: false, error: "Give the group a name of up to 60 characters." };
  const c = await db();
  if (!c) return { ok: false, error: "Private groups are for affiliates." };
  const { data, error } = await c.supabase.rpc("create_group", { p_name: n, p_members: ids(members) });
  if (error || !data) return { ok: false, error: "We could not create the group. Please try again." };
  revalidatePath("/groups");
  return { ok: true, id: data as string };
}

export async function addMembers(group: string, members: string[]): Promise<R> {
  if (!UUID.test(group)) return { ok: false, error: "Something went wrong." };
  const c = await db();
  if (!c) return { ok: false, error: "Private groups are for affiliates." };
  const { error } = await c.supabase.rpc("add_group_members", { p_group: group, p_members: ids(members) });
  if (error) return { ok: false, error: "Only the group owner can add people." };
  revalidatePath(`/groups/${group}`);
  return { ok: true };
}

/** The owner removes someone, or you leave (user = yourself). */
export async function removeMember(group: string, user: string): Promise<R> {
  if (!UUID.test(group) || !UUID.test(user)) return { ok: false, error: "Something went wrong." };
  const c = await db();
  if (!c) return { ok: false, error: "Private groups are for affiliates." };
  const { error } = await c.supabase.rpc("remove_group_member", { p_group: group, p_user: user });
  if (error) return { ok: false, error: "We could not do that." };
  revalidatePath("/groups"); revalidatePath(`/groups/${group}`);
  return { ok: true };
}

export async function renameGroup(group: string, name: string): Promise<R> {
  const n = String(name ?? "").trim();
  if (!UUID.test(group)) return { ok: false, error: "Something went wrong." };
  if (!n || n.length > 60) return { ok: false, error: "Give the group a name of up to 60 characters." };
  const c = await db();
  if (!c) return { ok: false, error: "Private groups are for affiliates." };
  const { error } = await c.supabase.rpc("rename_group", { p_group: group, p_name: n });
  if (error) return { ok: false, error: "Only the group owner can rename it." };
  revalidatePath("/groups"); revalidatePath(`/groups/${group}`);
  return { ok: true };
}

export async function sendGroupMessage(group: string, body: string, replyTo: string | null, image: string | null = null): Promise<R> {
  if (image && !/^https:\/\/media\d*\.giphy\.com\//.test(image)) return { ok: false, error: "That GIF did not work." };
  const text = image ? "GIF" : String(body ?? "").trim();
  if (!UUID.test(group) || (replyTo && !UUID.test(replyTo))) return { ok: false, error: "Something went wrong." };
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > MAX) return { ok: false, error: `Please keep messages under ${MAX} characters.` };
  const c = await db();
  if (!c) return { ok: false, error: "Private groups are for affiliates." };
  const { error } = await c.supabase.from("group_messages").insert({ group_id: group, author_id: c.me, body: text, ...(image ? { image_url: image } : {}), ...(replyTo ? { reply_to: replyTo } : {}) });
  if (error) return { ok: false, error: "We could not send that. Please try again." };
  revalidatePath(`/groups/${group}`);
  return { ok: true };
}

export async function deleteGroupMessage(id: string): Promise<R> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const c = await db();
  if (!c) return { ok: false, error: "Private groups are for affiliates." };
  const { error } = await c.supabase.from("group_messages").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not delete that." };
  return { ok: true };
}

export async function markRead(group: string): Promise<void> {
  if (!UUID.test(group)) return;
  const c = await db();
  if (c) await c.supabase.rpc("mark_group_read", { p_group: group });
}
