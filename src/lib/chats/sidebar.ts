import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activeMutes } from "./mutes";
import { listChatSections } from "./queries";
import type { ChatSection } from "./types";

export type GroupRow = { id: string; name: string; members: number; unread: number; last_body: string | null; last_author: string | null; last_at: string; is_owner: boolean };
export type Sidebar = { sections: ChatSection[]; muted: Set<string>; unread: Record<string, number>; groups: GroupRow[] };

/** Everything the left column of the Chats area needs: the chats, my groups (latest activity first), unread numbers and mutes. */
export async function loadSidebar(supabase: SupabaseClient, withGroups = true): Promise<Sidebar> {
  const [sections, muted, { data: un }, { data: gr }] = await Promise.all([
    listChatSections(supabase),
    activeMutes(supabase),
    supabase.rpc("chat_unreads"),
    withGroups ? supabase.rpc("group_overview") : Promise.resolve({ data: [] }),
  ]);
  const unread: Record<string, number> = {};
  for (const r of (un ?? []) as { chat_id: string; unread: number }[]) if (r.unread > 0) unread[r.chat_id] = r.unread;
  return { sections, muted, unread, groups: (gr ?? []) as GroupRow[] };
}
