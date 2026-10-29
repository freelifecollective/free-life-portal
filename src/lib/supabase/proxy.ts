import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { isReserved } from "@/lib/username";

const PUBLIC_PREFIXES = ["/login", "/auth", "/register", "/api/push", "/api/calendar"];

/**
 * Refreshes the session cookie on every request and sends signed-out visitors to /login.
 * This is an optimistic check only. Pages and actions still verify the user on the server.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  // A single word that is not one of the portal's own pages is a member's public landing page (/their-username).
  const isLanding = /^\/[a-z0-9_-]{3,30}\/?$/i.test(path) && !isReserved(path.replace(/\//g, ""));
  const isPublic = isLanding || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : "?next=" + encodeURIComponent(path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return response;
}
