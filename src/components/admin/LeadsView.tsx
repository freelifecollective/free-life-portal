import { LeadMemberFilter } from "@/components/admin/LeadMemberFilter";
import { requireAdmin } from "@/lib/auth/guards";

type L = { source: "account" | "invited" | "form"; id: string | null; first_name: string | null; last_name: string | null; email: string; created_at: string; in_portal: boolean; owner_id: string | null; owner_first: string | null; owner_last: string | null };
const nameOf = (p: { first_name: string | null; last_name: string | null }) => [p.first_name, p.last_name].filter(Boolean).join(" ");
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
const HOW = { account: "Has an account", invited: "Invited", form: "Filled in a call form" } as const;

/** Every lead, with the FLC member each one belongs to. Pick a member above to see only theirs. */
export async function LeadsView({ member }: { member?: string }) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_all_leads");
  const all = (data ?? []) as L[];
  const counts = new Map<string, { name: string; count: number }>();
  for (const l of all) if (l.owner_id) { const c = counts.get(l.owner_id) ?? { name: nameOf({ first_name: l.owner_first, last_name: l.owner_last }) || "A member", count: 0 }; c.count++; counts.set(l.owner_id, c); }
  const options = [...counts.entries()].map(([id, c]) => ({ id, ...c })).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const current = member === "none" || (member && counts.has(member)) ? member : "";
  const shown = !current ? all : current === "none" ? all.filter((l) => !l.owner_id) : all.filter((l) => l.owner_id === current);
  return (
    <>
      <p className="page-lede">Everyone who is a lead: people with an account, people who were invited, and people who filled in a call form.</p>
      <LeadMemberFilter options={options} current={current} />
      <p className="when" style={{ margin: "0 0 10px" }}>{`${shown.length} ${shown.length === 1 ? "lead" : "leads"}`}</p>
      {shown.length === 0 ? <p className="page-lede">No leads here yet.</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Lead</th><th scope="col">Email</th><th scope="col">Belongs to</th><th scope="col">How they came in</th><th scope="col">Date</th><th scope="col">In the portal</th></tr></thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.email}>
                  <td translate="no">{nameOf(l) || <span className="muted-line">Not finished</span>}</td>
                  <td>{l.email}</td>
                  <td translate="no">{l.owner_id ? nameOf({ first_name: l.owner_first, last_name: l.owner_last }) || "A member" : <span className="muted-line">No one yet</span>}</td>
                  <td>{HOW[l.source]}</td>
                  <td>{day(l.created_at)}</td>
                  <td>{l.in_portal ? "Yes" : "Not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
