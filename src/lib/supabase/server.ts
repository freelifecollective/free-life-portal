import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Supabase client for server components, server actions and route handlers. Acts as the signed-in user. */
export async function createClient() {
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
