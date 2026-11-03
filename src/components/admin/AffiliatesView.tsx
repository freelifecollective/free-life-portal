import { PersonStatus } from "@/components/admin/PersonStatus";
import { requireAdmin } from "@/lib/auth/guards";

type P = { coach_id?: string | null; outside_coach_name?: string | null; id: string; first_name: string | null; last_name: string | null; email: string | null; role: string; created_at: string; unpaid_since: string | null; removed_at: string | null };
type Past = P & { reason: "cancelled" | "unpaid" | "manual" | "blocked"; note: string | null };
const nameOf = (p: { first_name: string | null; last_name: string | null; email?: string | null }) => [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown";
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

/** What happened to someone who left, in plain words. */
function whatHappened(p: Past) {
  if (p.reason === "blocked") return <>Blocked from the portal{p.note ? <>: <span translate="no">{p.note}</span></> : null}</>;
  if (p.reason === "cancelled") return <>Cancelled their subscription and closed their account</>;
  if (p.reason === "unpaid") return <>Removed for non-payment{p.unpaid_since ? ` (unpaid since ${p.unpaid_since})` : ""}</>;
  return <>Removed by us{p.note ? <>: <span translate="no">{p.note}</span></> : " (no reason noted)"}</>;
}

/** Current members (with a status dropdown to change or remove them), and past members with what happened to each. */
export async function AffiliatesView({ view }: { view: "current" | "past" }) {
  const { session, supabase } = await requireAdmin();
  if (view === "past") {
    const past = ((await supabase.rpc("admin_past_people")).data ?? []) as Past[];
    return past.length === 0 ? <p className="page-lede">No one has left yet.</p> : (
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Was</th><th scope="col">Left on</th><th scope="col">What happened</th></tr></thead>
          <tbody>
            {past.map((p) => (
              <tr key={p.id}>
                <td translate="no">{nameOf(p)}</td><td>{p.email}</td><td>{p.role}</td>
                <td>{p.removed_at ? day(p.removed_at) : p.unpaid_since ?? ""}</td>
                <td>{whatHappened(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const { data } = await supabase.from("profiles").select("id, first_name, last_name, email, role, created_at, unpaid_since, removed_at, coach_id, outside_coach_name").in("role", ["member", "admin", "downline"]).not("onboarded_at", "is", null).is("removed_at", null).order("first_name").limit(2000);
  const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const cutoff = twoMonthsAgo.toISOString().slice(0, 10);
  const current = ((data ?? []) as P[]).filter((p) => !(p.unpaid_since && p.unpaid_since <= cutoff && p.role !== "downline"));
  const coachIds = [...new Set(current.map((p) => p.coach_id).filter((x): x is string => !!x))];
  const coachName = new Map<string, string>();
  if (coachIds.length) {
    const { data: cs } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", coachIds);
    for (const c of (cs ?? []) as P[]) coachName.set(c.id, nameOf(c));
  }
  const coachOf = (p: P) => (p.outside_coach_name ? `${p.outside_coach_name} (not in FLC)` : p.coach_id ? coachName.get(p.coach_id) ?? "" : "");
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Joined</th><th scope="col">Their Coach</th><th scope="col">Status</th></tr></thead>
        <tbody>
          {current.map((p) => (
            <tr key={p.id}>
              <td translate="no">{nameOf(p)}</td><td>{p.email}</td><td>{day(p.created_at)}</td>
              <td translate="no">{coachOf(p) || <span className="muted-line">Not chosen yet</span>}</td>
              <td>{p.id === session.user.id ? <span className="muted-line">{p.role} (you)</span> : <PersonStatus id={p.id} name={nameOf(p)} role={p.role} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
