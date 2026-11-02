import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next(); // preview mode: no accounts to protect
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|geojson|mjs)$).*)"],
};
