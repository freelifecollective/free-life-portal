import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { LiveBadge } from "@/components/LiveBadge";
import { LocalTime } from "@/components/calendar/LocalTime";
import { requireMember } from "@/lib/auth/guards";
import { Attendees } from "@/components/calendar/Attendees";
import { CopyInvite } from "@/components/dashboard/CopyInvite";
import { formatMoney } from "@/lib/payments/receipt";
import { upcomingPayments } from "@/lib/dashboard/payments";
import { parseRange, presets } from "@/lib/dashboard/range";
import { listUpcomingCalls, pickFeatured, rsvpSummary } from "@/lib/calls/queries";
import { AUDIENCE_LABEL, KIND_LABEL } from "@/lib/calls/types";
import { endsAt, formatInZone, nowMs, toZonedInput } from "@/lib/time";

export const instant = false; // renders per signed-in member
export const metadata = { title: "Home" };

type Stats = { visitors: number; clicks: number; forms: number; registered: number; call_registered: number };

const longDay = (day: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${day}T12:00:00Z`));
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

export default async function HomePage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const { session, supabase } = await requireMember();
  const { profile, mode } = session;
  const now = nowMs();
  const affiliate = profile.role !== "lead";
  const upcoming = supabase ? await listUpcomingCalls(supabase, now) : [];
  /* Affiliates promote the next call that is open to leads; leads just see the next call. */
  const next = (affiliate ? upcoming.find((c) => c.audience === "leads_open") : null) ?? pickFeatured(upcoming);
  const summary = supabase && next ? await rsvpSummary(supabase, next.id, 50) : null;
  const isLive = !!next && now >= new Date(next.starts_at).getTime() && now < endsAt(new Date(next.starts_at), next.duration_minutes).getTime();

  const range = parseRange(one(sp.from), one(sp.to), now);
  const today = toZonedInput(new Date(now)).slice(0, 10);
  let stats: Stats | null = null;
  let payments: ReturnType<typeof upcomingPayments> = [];
  if (supabase && affiliate) {
    const [{ data: st }, { data: last }] = await Promise.all([
      supabase.rpc("member_stats", { p_from: range.fromIso, p_to: range.toIso, p_call: next?.id ?? null }),
      supabase.from("payments").select("paid_at, amount_cents, currency, description").eq("member_id", session.user.id).eq("status", "paid").order("paid_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    stats = (st as Stats | null) ?? null;
    if (last) payments = upcomingPayments({ paid_on: toZonedInput(new Date(last.paid_at)).slice(0, 10), amount_cents: last.amount_cents, currency: last.currency, description: last.description }, today);
  }
  const leadsHref = (show?: string) => `/leads?from=${range.from}&to=${range.to}${show ? `&show=${show}` : ""}`;

  return (
    <>
      <PageHeading lede={affiliate ? "Your community and your numbers, all in one place." : "This is your home in the Free Life Collective. More of the portal arrives step by step."}>
        Welcome, {profile.first_name}
      </PageHeading>

      {supabase ? (
        <section className={"card-s dash-call" + (isLive ? " live-card on" : "")} aria-label="Next call">
          <div className="label" style={{ marginBottom: 8 }}>{isLive ? <LiveBadge>LIVE · Happening now</LiveBadge> : "Next community call"}</div>
          {next ? (
            <>
              <p className="dash-call-title">{next.title}</p>
              {next.host ? <p className="dash-host">Led by <strong>{next.host}</strong></p> : null}
              <p style={{ margin: "6px 0 0", fontWeight: 700 }}>{formatInZone(new Date(next.starts_at))}</p>
              <LocalTime iso={next.starts_at} />
              <p className="muted-line" style={{ margin: "6px 0 14px" }}>{KIND_LABEL[next.kind]} · {AUDIENCE_LABEL[next.audience]}</p>
              {affiliate && profile.username && next.audience === "leads_open" ? (
                <div className="dash-invite">
                  <CopyInvite username={profile.username} />
                  <p className="when" style={{ margin: 0 }}>Send this link to your leads so they can register for the call.</p>
                  <p className="dash-count"><strong>{stats?.call_registered ?? 0}</strong> {(stats?.call_registered ?? 0) === 1 ? "lead has" : "leads have"} registered from your link</p>
                </div>
              ) : null}
              {summary ? (
                <div style={{ margin: "16px 0" }}>
                  <p className="label" style={{ margin: "0 0 8px" }}>Everyone who has RSVPed</p>
                  <Attendees summary={summary} />
                </div>
              ) : null}
              <Link className="btn" href="/calendar" style={{ textDecoration: "none", height: 44 }}>RSVP on the calendar</Link>
            </>
          ) : (
            <p style={{ margin: 0 }}>No calls are scheduled yet. <Link className="linkbtn" href="/calendar" style={{ padding: 0 }}>Open the calendar</Link></p>
          )}
        </section>
      ) : null}

      {supabase && affiliate ? (
        <>
          <section className="dash-stats" aria-label="Your landing page results">
            <div className="dash-stats-head">
              <h2 className="qh" style={{ margin: 0 }}>Your results</h2>
              <p className="when" style={{ margin: 0 }}>{longDay(range.from)} to {longDay(range.to)}</p>
            </div>
            <div className="dash-filter">
              <div className="dash-presets">
                {presets(today).map((r) => (
                  <Link key={r.label} href={`/?from=${r.from}&to=${r.to}`} className={"chip" + (r.from === range.from && r.to === range.to ? " on" : "")}>{r.label}</Link>
                ))}
              </div>
              <form action="/" method="get" className="dash-custom">
                <label>From <input type="date" name="from" defaultValue={range.from} max={today} /></label>
                <label>To <input type="date" name="to" defaultValue={range.to} max={today} /></label>
                <button className="btn" type="submit">Apply dates</button>
              </form>
            </div>
            <div className="dash-tiles">
              <div className="stat-tile"><span className="stat-n">{stats?.visitors ?? 0}</span><span className="stat-l">People who visited your page</span></div>
              <div className="stat-tile"><span className="stat-n">{stats?.clicks ?? 0}</span><span className="stat-l">Clicks on &ldquo;save my spot&rdquo;</span><span className="stat-s">{pct(stats?.clicks ?? 0, stats?.visitors ?? 0)} of visitors</span></div>
              <Link href={leadsHref()} className="stat-tile link"><span className="stat-n">{stats?.forms ?? 0}</span><span className="stat-l">Form fill-outs</span><span className="stat-s">{pct(stats?.forms ?? 0, stats?.visitors ?? 0)} of visitors · see your leads →</span></Link>
              <Link href={leadsHref("registered")} className="stat-tile link"><span className="stat-n">{stats?.registered ?? 0}</span><span className="stat-l">Registered in the portal</span><span className="stat-s">{pct(stats?.registered ?? 0, stats?.forms ?? 0)} of fill-outs · see who →</span></Link>
            </div>
          </section>

          <section className="card-s dash-pay" aria-label="Upcoming payments">
            <h2 className="qh" style={{ margin: "0 0 10px" }}>Upcoming subscription payments</h2>
            {payments.length ? (
              <>
                <ul className="kv">
                  {payments.map((p) => <li key={p.date}><span>{longDay(p.date)}</span><span>{formatMoney(p.amount_cents, p.currency)} · {p.description}</span></li>)}
                </ul>
                <p className="when" style={{ margin: "10px 0 0" }}>Estimated from your last payment. <Link href="/settings/subscription">See your subscription</Link></p>
              </>
            ) : <p style={{ margin: 0 }}>No payments to show yet. <Link href="/settings/subscription">See your subscription</Link></p>}
          </section>
        </>
      ) : null}

      <section className="card-s" style={{ maxWidth: 460, marginTop: 20 }} aria-label="Your profile">
        <ul className="kv">
          <li><span>Username</span><span>@{profile.username}</span></li>
          <li><span>Instagram</span><span>{profile.instagram ? "@" + profile.instagram : "Not added yet"}</span></li>
          <li><span>Facebook</span><span>{profile.facebook ? "@" + profile.facebook : "Not added yet"}</span></li>
        </ul>
        {mode === "preview" ? <p className="status" style={{ marginBottom: 0 }}>Preview mode: nothing here is saved to a real account.</p> : null}
      </section>
    </>
  );
}
