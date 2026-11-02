import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";

type P = { id: string; first_name: string | null; last_name: string | null; email: string | null; role: string; created_at: string; unpaid_since: string | null; removed_at: string | null; onboarded_at: string | null };
const nameOf = (p: { first_name: string | null; last_name: string | null; email?: string | null }) => [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown";
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

/** Current members, past members, leads with accounts (and who they belong to), and each affiliate's own people. */
export async function AffiliatesView({ view, affiliate }: { view: "current" | "past" | "leads" | "by"; affiliate?: string }) {
  const tab = view;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("profiles").select("id, first_name, last_name, email, role, created_at, unpaid_since, removed_at, onboarded_at").in("role", ["member", "admin"]).not("onboarded_at", "is", null).order("first_name").limit(2000);
  const all = (data ?? []) as P[];
  const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const cutoff = twoMonthsAgo.toISOString().slice(0, 10);
  const isPast = (p: P) => !!p.removed_at || (!!p.unpaid_since && p.unpaid_since <= cutoff);
  const current = all.filter((p) => !isPast(p));
  const past = all.filter(isPast);
  const pickId = affiliate;
  const picked = tab === "by" ? current.concat(past).find((p) => p.id === pickId || nameOf(p).toLowerCase() === (pickId ?? "").toLowerCase()) : undefined;
  const leads = tab === "leads" ? ((await supabase.rpc("admin_leads_with_owner")).data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; created_at: string; owner_id: string | null; owner_first: string | null; owner_last: string | null }[] : [];
  const theirs = picked ? ((await supabase.rpc("admin_affiliate_people", { p_affiliate: picked.id })).data ?? []) as { kind: string; email: string; first_name: string | null; last_name: string | null; created_at: string; in_portal: boolean }[] : [];
  return (
    <>
      {tab === "current" || tab === "past" ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>{tab === "past" ? "Why" : "Their people"}</th></tr></thead>
            <tbody>
              {(tab === "current" ? current : past).map((p) => (
                <tr key={p.id}>
                  <td translate="no">{nameOf(p)}</td><td>{p.email}</td><td>{day(p.created_at)}</td>
                  <td>{tab === "past" ? (p.removed_at ? "Removed" : `Unpaid since ${p.unpaid_since}`) : <Link href={`/admin/people?view=by&affiliate=${p.id}`}>See who they invited</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "leads" ? (
        leads.length === 0 ? <p className="page-lede">No leads have an account yet.</p> : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>Lead</th><th>Email</th><th>Joined</th><th>Belongs to</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}><td translate="no">{nameOf(l)}</td><td>{l.email}</td><td>{day(l.created_at)}</td><td translate="no">{l.owner_id ? nameOf({ first_name: l.owner_first, last_name: l.owner_last }) : <span className="muted-line">No one yet</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "by" ? (
        <>
          <form method="get" action="/admin/people" className="admin-form" style={{ maxWidth: 520 }}>
            <input type="hidden" name="view" value="by" />
            <div className="field"><label htmlFor="aff">Choose an affiliate (type to search)</label>
              <input id="aff" name="affiliate" list="aff-list" defaultValue={picked ? nameOf(picked) : ""} autoComplete="off" />
              <datalist id="aff-list">{current.map((p) => <option key={p.id} value={nameOf(p)} />)}</datalist></div>
            <div className="actions" style={{ marginTop: 0 }}><button className="btn primary" type="submit">Show their people</button></div>
          </form>
          {pickId && !picked ? <p className="page-lede">No affiliate found with that name.</p> : null}
          {picked ? (
            <>
              <h2 className="qh" style={{ marginTop: 28 }}><span translate="no">{nameOf(picked)}</span>: {theirs.length} {theirs.length === 1 ? "person" : "people"}</h2>
              {theirs.length === 0 ? <p className="page-lede">Nobody yet.</p> : (
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Name</th><th>Email</th><th>How</th><th>On</th><th>In the portal</th></tr></thead>
                    <tbody>{theirs.map((t) => <tr key={t.kind + t.email}><td translate="no">{nameOf(t)}</td><td>{t.email}</td><td>{t.kind === "invited" ? "Invited by them" : "Filled in their page"}</td><td>{day(t.created_at)}</td><td>{t.in_portal ? "Yes" : "Not yet"}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
