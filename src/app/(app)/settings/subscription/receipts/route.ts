import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildReceiptsPdf, type Payment } from "@/lib/payments/receipt";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Receipts as one PDF. ?id=… one receipt, ?year=2026, ?from=…&to=… a custom period, ?all=1 everything. Only your own are ever returned. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.mode !== "supabase") return new NextResponse("Please sign in.", { status: 401 });
  const q = req.nextUrl.searchParams;
  const supabase = await createClient();
  let query = supabase.from("payments")
    .select("id, receipt_no, amount_cents, currency, description, status, paid_at")
    .eq("member_id", session.user.id).order("paid_at", { ascending: true }).limit(500);

  let label = "all";
  const id = q.get("id"), year = q.get("year"), from = q.get("from"), to = q.get("to");
  if (id) {
    if (!UUID.test(id)) return new NextResponse("Bad request.", { status: 400 });
    query = query.eq("id", id); label = "receipt";
  } else if (year) {
    if (!/^\d{4}$/.test(year)) return new NextResponse("Bad request.", { status: 400 });
    const a = zonedToUtc(`${year}-01-01T00:00`), b = zonedToUtc(`${Number(year) + 1}-01-01T00:00`);
    if (!a || !b) return new NextResponse("Bad request.", { status: 400 });
    query = query.gte("paid_at", a.toISOString()).lt("paid_at", b.toISOString()); label = year;
  } else if (from || to) {
    if (!from || !to || !DAY.test(from) || !DAY.test(to)) return new NextResponse("Choose both a start and an end date.", { status: 400 });
    const a = zonedToUtc(`${from}T00:00`), b = zonedToUtc(`${to}T23:59`);
    if (!a || !b || a > b) return new NextResponse("The start date must be before the end date.", { status: 400 });
    query = query.gte("paid_at", a.toISOString()).lte("paid_at", b.toISOString()); label = `${from}_to_${to}`;
  } else if (q.get("all") !== "1") {
    return new NextResponse("Bad request.", { status: 400 });
  }

  const { data } = await query;
  const rows = (data ?? []) as Payment[];
  if (rows.length === 0) return new NextResponse("There are no receipts for that choice.", { status: 404 });
  const p = session.profile;
  const bytes = await buildReceiptsPdf(rows, { name: [p.first_name, p.last_name].filter(Boolean).join(" "), email: session.user.email ?? "" });
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="flc-receipts-${label}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
