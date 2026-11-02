"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribe } from "@/lib/email/token";

export async function unsubscribe(email: string, token: string): Promise<{ ok: boolean }> {
  if (!verifyUnsubscribe(email, token)) return { ok: false };
  const db = createAdminClient();
  if (!db) return { ok: false };
  const em = email.trim().toLowerCase();
  await db.from("email_unsubscribes").upsert({ email: em });
  await db.from("email_outbox").update({ status: "skipped", error: "unsubscribed" }).eq("to_email", em).eq("status", "pending").not("series", "is", null);
  return { ok: true };
}
