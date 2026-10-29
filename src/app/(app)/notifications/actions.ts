"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";
import { TOUR_VERSION } from "@/lib/tour";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markRead(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  const { supabase } = await requireMember();
  await supabase?.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function markAllRead(): Promise<void> {
  const { session, supabase } = await requireMember();
  await supabase?.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.user.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function completeTour(): Promise<void> {
  const { session, supabase } = await requireMember();
  await supabase?.from("member_tour").upsert({ member_id: session.user.id, seen_version: TOUR_VERSION }, { onConflict: "member_id" });
}
