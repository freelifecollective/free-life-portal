"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/guards";

export type FinancingState = { error: string; sent?: number; approved?: boolean };

/** An affiliate suggests an option (waits for review). An admin's suggestion is approved straight away. */
export async function suggestFinancing(_prev: FinancingState, form: FormData): Promise<FinancingState> {
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const link = String(form.get("link") ?? "").trim();
  if (!title || title.length > 100) return { error: "Add a name of up to 100 characters." };
  if (!description || description.length > 1500) return { error: "Add a description of up to 1500 characters." };
  if (link && (!/^https:\/\/\S+$/.test(link) || link.length > 500)) return { error: "The link must start with https://" };
  const { session, supabase } = await requireMember();
  if (!supabase) return { error: "Needs the database." };
  if (session.profile.role === "lead") return { error: "Only affiliates can suggest financing options." };
  const admin = session.profile.role === "admin";
  const { error } = await supabase.from("financing_options").insert({
    title, description, link: link || null, submitted_by: session.user.id,
    ...(admin ? { status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: session.user.id } : {}),
  });
  if (error) {
    if (error.code === "23505") return { error: "That option is already in the list (or waiting for review)." };
    return { error: "We could not save that. Please try again." };
  }
  revalidatePath("/financing"); revalidatePath("/admin/financing"); revalidatePath("/", "layout");
  return { error: "", sent: 1, approved: admin };
}
