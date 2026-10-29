import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { CallCard } from "@/components/calendar/CallCard";
import { CallChip } from "@/components/calendar/CallChip";
import { CalendarFeed } from "@/components/calendar/CalendarFeed";
import { requireMember } from "@/lib/auth/guards";
import { rsvpSummary } from "@/lib/calls/queries";
import { CALL_COLUMNS, type Call } from "@/lib/calls/types";
import { CALL_ZONE, endsAt, nowMs, toZonedInput, zonedToUtc } from "@/lib/time";

export const instant = false; // depends on who is signed in
export const metadata = { title: "Calendar" };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const timeOf = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: CALL_ZONE, hour: "numeric", minute: "2-digit" }).format(d).replace(" ", "").toLowerCase();

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const sp = await props.searchParams;
  const { supabase } = await requireMember();
  if (!supabase) {
    return (
      <>
        <PageHeading>Calendar</PageHeading>
        <p className="page-lede">The calendar needs the database, which preview mode does not have.</p>
      </>
    );
  }
  const now = nowMs();
  const today = toZonedInput(new Date(now)).slice(0, 10); // YYYY-MM-DD, Eastern
  const mParam = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const mm = MONTH.exec(mParam ?? "") ?? MONTH.exec(today.slice(0, 7))!;
  const year = +mm[1], month = +mm[2];

  const first = zonedToUtc(`${key(year, month)}-01T00:00`)!;
  const next = zonedToUtc(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01T00:00`)!;
  const { data } = await supabase.from("calls").select(CALL_COLUMNS).gte("starts_at", new Date(first.getTime() - 86400_000).toISOString()).lt("starts_at", new Date(next.getTime() + 86400_000).toISOString()).order("starts_at");
  const calls = (data ?? []) as Call[];
  const summaries = await Promise.all(calls.map((c) => rsvpSummary(supabase, c.id, 50)));
  const byDay = new Map<string, { call: Call; summary: (typeof summaries)[number] }[]>();
  calls.forEach((c, i) => {
    const day = toZonedInput(new Date(c.starts_at)).slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), { call: c, summary: summaries[i] }]);
  });

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // weekday of the 1st
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const prev = month === 1 ? key(year - 1, 12) : key(year, month - 1);
  const nextKey = month === 12 ? key(year + 1, 1) : key(year, month + 1);
  const title = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const { data: tok } = await supabase.rpc("my_calendar_token", { p_reset: false });

  return (
    <>
      <PageHeading lede="All times are Eastern. Press a call to RSVP, see who is coming and join.">Calendar</PageHeading>
      <div className="cal-wrap">
        <div className="cal-bar">
          <h2 className="cal-title">{title}</h2>
          <nav className="cal-nav" aria-label="Change month">
            <Link className="btn" href={`/calendar?m=${prev}`} aria-label="Previous month">‹</Link>
            <Link className="btn" href="/calendar">Today</Link>
            <Link className="btn" href={`/calendar?m=${nextKey}`} aria-label="Next month">›</Link>
          </nav>
        </div>
        <div className="cal-grid" role="grid" aria-label={title}>
          {WEEKDAYS.map((w) => <div key={w} className="cal-dow" role="columnheader">{w}</div>)}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="cal-cell empty" role="gridcell" />;
            const dayKey = `${key(year, month)}-${String(d).padStart(2, "0")}`;
            const items = byDay.get(dayKey) ?? [];
            return (
              <div key={i} className={"cal-cell" + (dayKey === today ? " today" : "")} role="gridcell">
                <span className="cal-num">{d}</span>
                {items.map(({ call, summary }) => {
                  const start = new Date(call.starts_at);
                  const end = endsAt(start, call.duration_minutes).getTime();
                  return (
                    <CallChip key={call.id} time={timeOf(start)} title={call.title} live={now >= start.getTime() && now < end} past={now >= end}>
                      <CallCard call={call} summary={summary} now={now} />
                    </CallChip>
                  );
                })}
              </div>
            );
          })}
        </div>
        {typeof tok === "string" ? <CalendarFeed token={tok} /> : null}
      </div>
    </>
  );
}
