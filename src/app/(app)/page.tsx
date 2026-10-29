import Link from "next/link";
import { LiveBadge } from "@/components/LiveBadge";
import { LocalTime } from "@/components/calendar/LocalTime";
import { requireMember } from "@/lib/auth/guards";
import { Attendees } from "@/components/calendar/Attendees";
import { AddToCalendar } from "@/components/dashboard/AddToCalendar";
import { Countdown } from "@/components/dashboard/Countdown";
import { CopyInvite } from "@/components/dashboard/CopyInvite";
import { parseRange, presets } from "@/lib/dashboard/range";
import { isQuoteStyle, quoteFor, type QuoteStyle } from "@/lib/quotes";
import { listUpcomingCalls, pickFeatured, rsvpSummary } from "@/lib/calls/queries";
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
  const { profile } = session;
  const now = nowMs();
  const affiliate = profile.role !== "lead";
  const upcoming = supabase ? await listUpcomingCalls(supabase, now) : [];
  /* Affiliates promote the next call that is open to leads; leads just see the next call. */
  const next = (affiliate ? upcoming.find((c) => c.audience === "leads_open") : null) ?? pickFeatured(upcoming);
  const summary = supabase && next ? await rsvpSummary(supabase, next.id, 50) : null;
  const isLive = !!next && now >= new Date(next.starts_at).getTime() && now < endsAt(new Date(next.starts_at), next.duration_minutes).getTime();

  let quoteStyle: QuoteStyle = "general";
  if (supabase) {
    const { data: pref } = await supabase.from("member_prefs").select("quote_style").maybeSingle();
    if (isQuoteStyle(pref?.quote_style)) quoteStyle = pref.quote_style;
  }
  const quote = quoteFor(quoteStyle, toZonedInput(new Date(now)).slice(0, 10));

  const range = parseRange(one(sp.from), one(sp.to), now);
  const today = toZonedInput(new Date(now)).slice(0, 10);
  let stats: Stats | null = null;
  if (supabase && affiliate) {
    const { data: st } = await supabase.rpc("member_stats", { p_from: range.fromIso, p_to: range.toIso, p_call: next?.id ?? null });
    stats = (st as Stats | null) ?? null;
  }
  const leadsHref = (show?: string) => `/leads?from=${range.from}&to=${range.to}${show ? `&show=${show}` : ""}`;

  const endIso = next ? endsAt(new Date(next.starts_at), next.duration_minutes).toISOString() : "";
  const registeredFromLink = stats?.call_registered ?? 0;

  return (
    <div className="home">
      <header className="home-head">
        <p className="home-eyebrow">Free Life Collective</p>
        <h1 className="home-title">Welcome, {profile.first_name}</h1>
        <blockquote className="home-quote" style={{ margin: "14px auto 0" }}>
          <q>{quote.text}</q>
          {quote.by ? <cite>{quote.by}</cite> : null}
        </blockquote>
      </header>

      {supabase ? (
        <div className="home-row">
          <section className={"home-call" + (isLive ? " live" : "")} aria-label="Next call">
            <div className="hc-top">
              <span className="hc-label">{affiliate ? "Next community call" : "Next call"}</span>
              {isLive ? <LiveBadge>LIVE</LiveBadge> : next?.audience === "leads_open" ? <span className="hc-open"><span className="hc-dot" />Registration open</span> : null}
            </div>
            {next ? (
              <>
                <h2 className="hc-title">{next.title}</h2>
                <p className="hc-meta">{next.host ? <>Hosted by <strong>{next.host}</strong> · </> : null}{formatInZone(new Date(next.starts_at))}</p>
                <LocalTime iso={next.starts_at} />
                <Countdown startsAt={next.starts_at} endsAt={endIso} />
                <div className="hc-actions">
                  {affiliate && profile.username && next.audience === "leads_open" ? <CopyInvite username={profile.username} className="dc-btn" /> : <Link className="dc-btn" href="/calendar">RSVP on the calendar</Link>}
                  <AddToCalendar call={next} />
                </div>
              </>
            ) : <p className="hc-title" style={{ fontSize: 22 }}>No calls are scheduled yet. <Link href="/calendar" style={{ color: "inherit" }}>Open the calendar</Link></p>}
          </section>

          <section className="home-side" aria-label="Who is coming">
            {next ? (
              <>
                {affiliate && next.audience === "leads_open" ? (
                  <div className="hs-block">
                    <span className="hs-label">Registered from your link</span>
                    <span className="hs-big">{registeredFromLink}</span>
                    <span className="when">{registeredFromLink === 1 ? "lead has" : "leads have"} registered for this call</span>
                  </div>
                ) : null}
                <div className="hs-block">
                  <span className="hs-label">Total RSVPs</span>
                  <span className="hs-big">{(summary?.live ?? 0) + (summary?.recording ?? 0)}</span>
                  {summary ? <Attendees summary={summary} /> : null}
                </div>
                <Link className="linkbtn" href="/calendar" style={{ padding: 0 }}>RSVP on the calendar →</Link>
              </>
            ) : <p className="when" style={{ margin: 0 }}>When a call is scheduled, everyone who RSVPs shows up here.</p>}
          </section>
        </div>
      ) : null}

      {supabase && affiliate ? (
        <>
          <section className="home-stats" aria-label="Your landing page results">
            <div className="hst-bar">
              <div><h2 className="hst-title">Your results</h2><p className="when" style={{ margin: 0 }}>{longDay(range.from)} to {longDay(range.to)}</p></div>
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
            </div>
            <div className="hst-strip">
              <div className="hst-cell"><span className="hst-l">Visited your page</span><span className="hst-n">{stats?.visitors ?? 0}</span></div>
              <div className="hst-cell"><span className="hst-l">Clicks</span><span className="hst-n">{stats?.clicks ?? 0}</span><span className="stat-s">{pct(stats?.clicks ?? 0, stats?.visitors ?? 0)} of visitors</span></div>
              <Link href={leadsHref()} className="hst-cell link"><span className="hst-l">Form fill-outs</span><span className="hst-n">{stats?.forms ?? 0}</span><span className="stat-s">{pct(stats?.forms ?? 0, stats?.visitors ?? 0)} of visitors · see your leads →</span></Link>
              <Link href={leadsHref("registered")} className="hst-cell link"><span className="hst-l">Registered in the portal</span><span className="hst-n">{stats?.registered ?? 0}</span><span className="stat-s">{pct(stats?.registered ?? 0, stats?.forms ?? 0)} of fill-outs · see who →</span></Link>
            </div>
          </section>

        </>
      ) : null}
    </div>
  );
}
