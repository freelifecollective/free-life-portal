"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

export type NewSubmission = { title: string; description: string; links: string[]; files: { path: string; name: string; size: number }[] };

/** Saves a resource for the admins to review. The files are already uploaded to the person's own folder. */
export async function submitResource(input: NewSubmission): Promise<{ ok: boolean; error?: string }> {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const links = (input.links ?? []).map((l) => String(l).trim()).filter(Boolean);
  if (!title || title.length > 120) return { ok: false, error: "Add a title of up to 120 characters." };
  if (!description || description.length > 2000) return { ok: false, error: "Add a description of up to 2000 characters." };
  if (links.length > 5 || links.some((l) => !/^https:\/\/\S+$/.test(l) || l.length > 500)) return { ok: false, error: "Links must start with https:// (up to 5)." };
  const { session, supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const prefix = `${session.user.id}/`;
  const files = (input.files ?? []).slice(0, 5).filter((f) => typeof f.path === "string" && f.path.startsWith(prefix) && !f.path.includes(".."))
    .map((f) => ({ path: f.path, name: String(f.name).slice(0, 120), size: Number(f.size) || 0 }));
  const { error } = await supabase.from("resource_submissions").insert({ submitter_id: session.user.id, title, description, links, files });
  if (error) return { ok: false, error: "We could not send that. Please try again." };
  revalidatePath("/admin/resources");
  revalidatePath("/chats/resources");
  return { ok: true };
}
