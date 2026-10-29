"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";

export type AnnouncementState = { error: string; sent?: number };

/** Tells everyone: a notification in their list, and a push to those who turned it on. */
export async function postAnnouncement(prev: AnnouncementState, form: FormData): Promise<AnnouncementState> {
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  if (!title || title.length > 120) return { error: "Add a title of up to 120 characters." };
  if (body.length > 400) return { error: "Keep the message under 400 characters." };
  if (url && !/^\/[A-Za-z0-9/_-]*$/.test(url)) return { error: "The page must start with / (for example /financing)." };
  const { session, supabase } = await requireAdmin();
  const { error } = await supabase.from("announcements").insert({ title, body: body || null, url: url || null, created_by: session.user.id });
  if (error) return { error: "We could not send that. Please try again." };
  revalidatePath("/admin/announcements");
  return { error: "", sent: (prev.sent ?? 0) + 1 };
}
