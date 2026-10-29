import { UndoButton } from "@/components/admin/UndoButton";
import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import { formatInZone } from "@/lib/time";

export const instant = false;
export const metadata = { title: "Activity log" };

type Row = { id: number; actor_id: string | null; action: string; summary: string; created_at: string; undone_at: string | null; undone_by: string | null };

export default async function ActivityPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("audit_log").select("id, actor_id, action, summary, created_at, undone_at, undone_by").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as Row[];
  const people = await authorsById(supabase, rows.flatMap((r) => [r.actor_id, r.undone_by]).filter((x): x is string => !!x));
  const name = (id: string | null) => (id ? people.get(id)?.name ?? "An admin" : "System");
  return (
    <>
      <PageHeading lede="Everything an admin adds, changes or removes, with who did it and when. Press Undo to put something back.">Activity log</PageHeading>
      {rows.length === 0 ? <p className="page-lede">Nothing yet.</p> : (
        <ul className="activity">
          {rows.map((r) => (
            <li key={r.id} className={r.undone_at ? "undone" : ""}>
              <div className="act-main">
                <strong>{r.summary}</strong>
                <span className="when">{name(r.actor_id)} · {formatInZone(new Date(r.created_at))}{r.undone_at ? ` · Undone by ${name(r.undone_by)}` : ""}</span>
              </div>
              {r.action !== "undo" && !r.undone_at ? <UndoButton id={r.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
