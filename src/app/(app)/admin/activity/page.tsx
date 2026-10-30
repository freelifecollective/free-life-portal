import { ActivityMonth } from "@/components/admin/ActivityMonth";
import { UndoButton } from "@/components/admin/UndoButton";
import { PageHeading } from "@/components/PageHeading";
import { groupByWeek, monthOf, monthOptions, monthRange } from "@/lib/activity/weeks";
import { requireAdmin } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import { formatInZone, nowMs } from "@/lib/time";

export const instant = false;
export const metadata = { title: "Activity log" };

type Row = { id: number; actor_id: string | null; action: string; summary: string; created_at: string; undone_at: string | null; undone_by: string | null };

export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  const sp = await props.searchParams;
  const { supabase } = await requireAdmin();
  const now = nowMs();
  const thisMonth = monthOf(now);
  const asked = Array.isArray(sp.m) ? sp.m[0] : sp.m;

  /* the months in the dropdown run from the very first entry up to now */
  const { data: first } = await supabase.from("audit_log").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle();
  const months = monthOptions(first ? Date.parse(first.created_at) : now, now);
  const month = months.some((m) => m.value === asked) ? (asked as string) : thisMonth;
  const range = monthRange(month)!;

  const { data } = await supabase.from("audit_log").select("id, actor_id, action, summary, created_at, undone_at, undone_by")
    .gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString()).order("created_at", { ascending: false }).limit(1000);
  const rows = (data ?? []) as Row[];
  const people = await authorsById(supabase, rows.flatMap((r) => [r.actor_id, r.undone_by]).filter((x): x is string => !!x));
  const name = (id: string | null) => (id ? people.get(id)?.name ?? "An admin" : "System");
  const weeks = groupByWeek(rows);
  const label = months.find((m) => m.value === month)?.label ?? month;

  return (
    <>
      <PageHeading lede="Everything an admin adds, changes or removes, with who did it and when. Press Undo to put something back.">Activity log</PageHeading>
      <div className="act-bar">
        <ActivityMonth months={months} current={month} />
        <p className="when" style={{ margin: 0 }}>{label}{month === thisMonth ? " (this month)" : ""} · {rows.length} {rows.length === 1 ? "entry" : "entries"}</p>
      </div>
      {weeks.length === 0 ? <p className="page-lede">Nothing in {label}.</p> : (
        <div className="act-weeks">
          {weeks.map((w, i) => (
            <details key={w.start} className="act-week" open={i === 0}>
              <summary><span>{w.label}</span><span className="act-count">{w.rows.length}</span></summary>
              <ul className="activity">
                {w.rows.map((r) => (
                  <li key={r.id} className={r.undone_at ? "undone" : ""}>
                    <div className="act-main">
                      <strong>{r.summary}</strong>
                      <span className="when">{name(r.actor_id)} · {formatInZone(new Date(r.created_at))}{r.undone_at ? ` · Undone by ${name(r.undone_by)}` : ""}</span>
                    </div>
                    {r.action !== "undo" && !r.undone_at ? <UndoButton id={r.id} /> : null}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
