import { NextResponse } from "next/server";
import { drainOutbox } from "@/lib/email/send";

/** Called every few minutes by the scheduler (vercel.json). It must carry the CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "not allowed" }, { status: 401 });
  return NextResponse.json(await drainOutbox());
}
