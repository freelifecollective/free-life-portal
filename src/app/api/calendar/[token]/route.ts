import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcs } from "@/lib/calls/ics";
import { CALL_COLUMNS, type Call } from "@/lib/calls/types";

/** The private calendar link people subscribe to. The long random token in the address is the key. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = createAdminClient();
  if (!db || !/^[a-f0-9]{64}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const { data: row } = await db.from("calendar_tokens").select("user_id").eq("token", token).maybeSingle();
  if (!row) return new NextResponse("Not found", { status: 404 });
  const { data: p } = await db.from("profiles").select("role, removed_at").eq("id", row.user_id).maybeSingle();
  if (!p || p.removed_at) return new NextResponse("Not found", { status: 404 });
  let q = db.from("calls").select(CALL_COLUMNS).gte("starts_at", new Date(Date.now() - 30 * 86400_000).toISOString()).order("starts_at");
  if (p.role === "lead") q = q.eq("audience", "leads_open");
  const { data } = await q;
  const ics = buildIcs((data ?? []) as Call[], `${req.nextUrl.origin}/calls`);
  return new NextResponse(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" } });
}
