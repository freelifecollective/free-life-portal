import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/env";
import { clearPreviewProfile } from "@/lib/profile/preview";
import { createClient } from "@/lib/supabase/server";

/** POST only, so a link or an image cannot sign someone out. */
export async function POST(request: NextRequest) {
  if (supabaseConfigured) await (await createClient()).auth.signOut({ scope: "local" }); // only this device, never everyone's
  else await clearPreviewProfile();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
