import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { CancelSubscription } from "@/components/settings/CancelSubscription";
import { requireMember } from "@/lib/auth/guards";
import { formatMoney, type Payment } from "@/lib/payments/receipt";
import { formatInZone } from "@/lib/time";

export const instant = false;
export const metadata = { title: "My Subscription" };

export default async function SubscriptionPage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/settings");
  if (!supabase) return <><PageHeading>My Subscription</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.from("payments")
    .select("id, receipt_no, amount_cents, currency, description, status, paid_at")
    .order("paid_at", { ascending: false }).limit(500);
  const payments = (data ?? []) as Payment[];
  const years = [...new Set(payments.map((p) => new Date(p.paid_at).getFullYear()))].sort((a, b) => b - a);
  const total = payments.filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_cents, 0);

  return (
    <>
      <PageHeading>My Subscription</PageHeading>
      <div className="settings">
        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>Your plan</h2>
          <dl className="set-list">
            <div><dt>Current plan</dt><dd>Not connected yet</dd></div>
            <div><dt>Next payment</dt><dd>Not connected yet</dd></div>
          </dl>
          <div className="plan-actions">
            <button className="btn" type="button" disabled>Upgrade</button>
            <button className="btn" type="button" disabled>Downgrade</button>
          </div>
          <p className="when" style={{ margin: "10px 0 0" }}>Plans will appear here once they are set up, and you will be able to switch between them yourself.</p>
        </section>

        <section className="card-s">
          <h2 className="qh" style={{ marginTop: 0 }}>Payment history</h2>
          {payments.length === 0 ? (
            <p style={{ margin: 0 }}>No payments yet. When you pay, they will show here with a receipt you can download.</p>
          ) : (
            <>
              <p className="when" style={{ margin: "0 0 10px" }}>{payments.length} {payments.length === 1 ? "payment" : "payments"} · {formatMoney(total)} paid in total</p>
              <ul className="pay-list">
                {payments.map((p) => (
                  <li key={p.id}>
                    <span className="pay-dot" aria-hidden="true" />
                    <span className="pay-main"><strong>{formatMoney(p.amount_cents, p.currency)}</strong><span>{p.description}{p.status === "refunded" ? " (refunded)" : ""}</span></span>
                    <time className="when" dateTime={p.paid_at}>{formatInZone(new Date(p.paid_at))}</time>
                    <a className="btn small" href={`/settings/subscription/receipts?id=${p.id}`} style={{ textDecoration: "none" }}>Receipt</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {payments.length ? (
          <section className="card-s">
            <h2 className="qh" style={{ marginTop: 0 }}>Download receipts</h2>
            <div className="dl-grid">
              <form action="/settings/subscription/receipts" method="get">
                <input type="hidden" name="all" value="1" />
                <p className="dl-label">Everything</p>
                <button className="btn small" type="submit">Download all</button>
              </form>
              <form action="/settings/subscription/receipts" method="get">
                <p className="dl-label"><label htmlFor="dl-year">By year</label></p>
                <select id="dl-year" name="year" defaultValue={years[0]}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                <button className="btn small" type="submit">Download</button>
              </form>
              <form action="/settings/subscription/receipts" method="get">
                <p className="dl-label">Custom period</p>
                <label className="sr-only" htmlFor="dl-from">From</label><input id="dl-from" type="date" name="from" required />
                <label className="sr-only" htmlFor="dl-to">To</label><input id="dl-to" type="date" name="to" required />
                <button className="btn small" type="submit">Download</button>
              </form>
            </div>
            <p className="when" style={{ margin: "10px 0 0" }}>Each download is one PDF with a page per receipt.</p>
          </section>
        ) : null}

        <section className="card-s">
          <CancelSubscription />
        </section>
      </div>
    </>
  );
}
