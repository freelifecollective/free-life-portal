import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendPushForNotifications } from "@/lib/notifications/push";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Called by the database right after it stores new notifications. Protected by a shared secret. */
export async function POST(req: NextRequest) {
  const secret = process.env.PUSH_SECRET ?? "";
  const given = req.headers.get("x-push-secret") ?? "";
  const a = Buffer.from(secret), b = Buffer.from(given);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse("Not allowed.", { status: 401 });
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 1000) : [];
  const sent = await sendPushForNotifications(ids);
  return NextResponse.json({ ok: true, sent });
}
