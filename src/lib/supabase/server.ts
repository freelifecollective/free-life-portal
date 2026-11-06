import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { previewStore } from "@/lib/locked/preview";

/** The client that checks who is signed in (always uses the real cookies). */
export async function createAuthClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    /* stay signed in on this device for well over a year, until the person logs out */
    cookieOptions: { maxAge: 60 * 60 * 24 * 400 },
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a server component: the proxy refreshes the session instead */
        }
      },
    },
  });
}

/** While a locked page is drawn for the downline: a client signed in as the shared "preview member" account, so the page shows what a paying member sees (and nothing the member account may not see). */
const previewMember = cache(async () => {
  const email = process.env.PREVIEW_MEMBER_EMAIL, password = process.env.PREVIEW_MEMBER_PASSWORD;
  if (!email || !password) return null;
  const client = createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? null : client;
});

/** Supabase client for server components, server actions and route handlers. Acts as the signed-in user. */
export async function createClient() {
  if (previewStore.getStore()) { const m = await previewMember(); if (m) return m; }
  return createAuthClient();
}
