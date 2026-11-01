import { redirect } from "next/navigation";
import { CloserHub, type Person, type Stats } from "@/components/closer-hub/CloserHub";
import { HireRequests, type Request } from "@/components/closers/HireRequests";
import { totalCalls } from "@/lib/closer/total";
import { OpenHoursCard } from "@/components/booking/OpenHoursCard";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import type { PayRule } from "@/lib/closer/pay";
import type { HubCall } from "@/lib/closer/types";
import { nowMs } from "@/lib/time";

export const instant = false;
export const metadata = { title: "Call Closer" };

export default async function CallCloserPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Call Closer</PageHeading><p className="page-lede">This needs the database.</p></>;
  const me = session.user.id;
  const { data: prof } = await supabase.from("profiles").select("call_closer").eq("id", me).maybeSingle();
  if (!(prof as { call_closer: boolean } | null)?.call_closer) redirect("/");
  const [r1, r2, r3, r4, r5] = await Promise.all([
    supabase.from("call_closer_details").select("paused, price_per_call_cents, calls_taken, close_rate").eq("member_id", me).maybeSingle(),
    supabase.rpc("closer_stats", { p_id: me }),
    supabase.from("closer_hires").select("id, member_id, calls_total, calls_used, note, status").eq("closer_id", me).in("status", ["pending", "active"]).order("created_at"),
    supabase.from("booked_calls").select("id, member_id, lead_name, starts_at, note, outcome, pay_points, pay_call_cents, pay_products_cents, pay_currency, paid_cents, paid_at").eq("closer_id", me).order("starts_at", { ascending: false }).limit(300),
    supabase.from("closer_pay_rules").select("rank_from, rank_to, kind, amount").eq("closer_id", me).order("rank_from"),
  ]);
  const { data: det } = r1, { data: st } = r2, { data: hires } = r3, { data: cs } = r4, { data: rl } = r5;
  const problems = [r1, r2, r3, r4, r5].flatMap((r) => (r.error ? [r.error.message] : []));
  if (problems.length) {
    return (
      <>
        <PageHeading>Call Closer</PageHeading>
        <section className="card-s" style={{ maxWidth: 640 }}>
          <h2 className="qh" style={{ marginTop: 0 }}>The Call Closer page could not load</h2>
          <p style={{ margin: "0 0 10px" }}>The latest database update for this page probably has not been run yet. Please run <b>0070_closer_hub.sql</b>, then refresh.</p>
          <p className="when" style={{ margin: 0 }} translate="no">{[...new Set(problems)].join(" · ")}</p>
        </section>
      </>
    );
  }
  const ids = ((cs ?? []) as { id: string }[]).map((c) => c.id);
  const { data: prods } = ids.length ? await supabase.from("booked_call_products").select("booked_call_id, product, qty").in("booked_call_id", ids) : { data: [] };
  const byCall = new Map<string, Record<string, number>>();
  for (const p of (prods ?? []) as { booked_call_id: string; product: string; qty: number }[]) byCall.set(p.booked_call_id, { ...(byCall.get(p.booked_call_id) ?? {}), [p.product]: p.qty });
  const calls: HubCall[] = ((cs ?? []) as Omit<HubCall, "products">[]).map((c) => ({ ...c, products: byCall.get(c.id) ?? {} }));
  const hireRows = (hires ?? []) as { id: string; member_id: string; calls_total: number | null; calls_used: number; note: string | null; status: "pending" | "active" }[];
  const authors = await authorsById(supabase, [...new Set([...calls.map((c) => c.member_id), ...hireRows.map((h) => h.member_id)])]);
  const people: Record<string, Person> = {};
  for (const [id, a] of authors) people[id] = { id, name: a.name, avatar_url: a.avatar_url };
  const requests: Request[] = hireRows.map((h) => ({ ...h, name: people[h.member_id]?.name ?? "A member", avatar_url: people[h.member_id]?.avatar_url ?? null }));

  const d = det as { paused: boolean; price_per_call_cents: number | null; calls_taken: string | null; close_rate: number | null } | null;
  const s = ((st ?? []) as { calls_counted: number; review_count: number; avg_rating: number | null; members_counted: number; members_base: string | null }[])[0];
  const recorded = calls.filter((c) => c.outcome === "took_place");
  const closed = recorded.filter((c) => Object.keys(c.products).length > 0).length;
  const stats: Stats = {
    calls: totalCalls(d?.calls_taken ?? null, s?.calls_counted ?? 0) ?? "0",
    recorded: recorded.length, closed,
    closeRate: recorded.length ? `${Math.round((closed / recorded.length) * 100)}%` : d?.close_rate != null ? `${d.close_rate}%` : "–",
    rating: s?.avg_rating ?? null, reviews: s?.review_count ?? 0,
    members: totalCalls(s?.members_base ?? null, s?.members_counted ?? 0) ?? "0",
  };
  const rules: PayRule[] = ((rl ?? []) as { rank_from: number; rank_to: number; kind: "flat" | "percent"; amount: number | string }[]).map((r) => ({ ...r, amount: Number(r.amount) }));
  return (
    <>
      <PageHeading lede="Your clients, your calls, what you are owed and how you are doing.">Call Closer</PageHeading>
      <div className="stack" style={{ maxWidth: 860 }}>
        {requests.length ? <HireRequests requests={requests} /> : null}
      </div>
      <OpenHoursCard />
      <CloserHub now={nowMs()} paused={!!d?.paused} calls={calls} people={people} rules={rules} stats={stats} price={d?.price_per_call_cents ?? null} />
    </>
  );
}
