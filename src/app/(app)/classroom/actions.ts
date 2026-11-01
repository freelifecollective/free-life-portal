"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ticks a lesson off (or back on). */
export async function setLessonDone(lessonId: string, done: boolean): Promise<{ ok: boolean }> {
  if (!UUID.test(lessonId)) return { ok: false };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false };
  const { error } = done
    ? await supabase.from("classroom_progress").upsert({ user_id: session.user.id, lesson_id: lessonId }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true })
    : await supabase.from("classroom_progress").delete().eq("user_id", session.user.id).eq("lesson_id", lessonId);
  revalidatePath("/classroom", "layout");
  return { ok: !error };
}
