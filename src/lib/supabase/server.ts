import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { previewStore } from "@/lib/locked/preview";
import { previewLogin } from "@/lib/locked/account";

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
  const login = await previewLogin();
  if (!login) return null;
  const client = createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(login);
  return error || !data.user ? null : { client, id: data.user.id };
});
/** The preview member's id, while a locked page is being drawn. */
export async function previewMemberId() { return (await previewMember())?.id ?? null; }

/** Supabase client for server components, server actions and route handlers. Acts as the signed-in user. */
export async function createClient() {
  if (previewStore.getStore()) { const m = await previewMember(); if (m) return m.client; }
  return createAuthClient();
}
