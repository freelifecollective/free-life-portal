import Link from "next/link";
import { requireMember } from "@/lib/auth/guards";
import { BookedCalls, type BookedCall } from "@/components/dashboard/BookedCalls";
import { NextCallCard } from "@/components/dashboard/NextCallCard";
import { listAffiliates } from "@/lib/calls/affiliates";
import { getTz } from "@/lib/tasks/queries";
import { parseRange, presets } from "@/lib/dashboard/range";
import { isQuoteStyle, quoteFor, type QuoteStyle } from "@/lib/quotes";
import { listUpcomingCalls, pickFeatured, rsvpSummary } from "@/lib/calls/queries";
import { formatInZone, nowMs, toZonedInput } from "@/lib/time";

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
  /* calls booked with leads, coming up, and who is taking each one */
  const tz = supabase ? await getTz(supabase) : "America/New_York";
  let booked: BookedCall[] = [];
  if (supabase && affiliate) {
    const [{ data: rows }, list] = await Promise.all([
      supabase.from("booked_calls").select("id, lead_name, starts_at, closer_id").eq("member_id", session.user.id).gte("starts_at", new Date(now - 3600_000).toISOString()).order("starts_at").limit(10),
      listAffiliates(supabase),
    ]);
    booked = (rows ?? []).map((r) => {
      const c = r.closer_id ? list.find((x) => x.id === r.closer_id) : null;
      return { id: r.id as string, lead_name: r.lead_name as string, when: formatInZone(new Date(r.starts_at as string), tz), closer: c ? { name: c.name, photo_url: c.photo_url } : null };
    });
  }
  const leadsHref = (show?: string) => `/leads?from=${range.from}&to=${range.to}${show ? `&show=${show}` : ""}`;

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
          <NextCallCard call={next ?? null} summary={summary} now={now} inviteUsername={affiliate ? profile.username : null} />

          {affiliate ? (
            <div className="home-col">
              {next?.audience === "leads_open" ? (
                <section className="home-side" aria-label="Registered from your link">
                  <div className="hs-block">
                    <span className="hs-label">Registered from your link</span>
                    <span className="hs-big">{registeredFromLink}</span>
                    <span className="when">{registeredFromLink === 1 ? "lead has" : "leads have"} registered for this call</span>
                  </div>
                </section>
              ) : null}
              <BookedCalls calls={booked} />
            </div>
          ) : null}
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
