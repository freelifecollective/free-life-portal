import "server-only";
import { createHmac } from "node:crypto";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = "locked.preview@flc-preview.invalid";

/** The shared "preview member": an ordinary, empty member account the locked pages are read through. It is created the first time it is needed, and its password comes from the project's secret key, so nothing has to be set up by hand. */
export const previewLogin = cache(async (): Promise<{ email: string; password: string } | null> => {
  const email = process.env.PREVIEW_MEMBER_EMAIL, password = process.env.PREVIEW_MEMBER_PASSWORD;
  if (email && password) return { email, password };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createAdminClient();
  if (!key || !admin) return null;
  const login = { email: EMAIL, password: createHmac("sha256", key).update("flc-locked-preview-v1").digest("hex").slice(0, 40) };
  try {
    const { data: have } = await admin.from("profiles").select("id, role, onboarded_at").eq("email", EMAIL).maybeSingle();
    if (!have) {
      await admin.from("signup_allowlist").upsert({ email: EMAIL, role: "member", note: "Shared account behind the locked-page previews. Keep it empty." });
      const made = await admin.auth.admin.createUser({ email: EMAIL, password: login.password, email_confirm: true });
      if (made.error && !/already/i.test(made.error.message)) return null;
    }
    await admin.from("profiles").update({ first_name: "Preview", last_name: "Member", role: "member", onboarded_at: have?.onboarded_at ?? new Date().toISOString() }).eq("email", EMAIL);
  } catch { return null; }
  return login;
});

/** The page the "Landing Page" preview shows: the first admin's own page. */
export const previewLandingUsername = cache(async (): Promise<string | null> => {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("profiles").select("username").eq("role", "admin").not("username", "is", null).order("created_at").limit(1).maybeSingle();
  return (data as { username: string } | null)?.username ?? null;
});
