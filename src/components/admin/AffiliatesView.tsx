import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";

type P = { id: string; first_name: string | null; last_name: string | null; email: string | null; role: string; created_at: string; unpaid_since: string | null; removed_at: string | null; onboarded_at: string | null };
const nameOf = (p: { first_name: string | null; last_name: string | null; email?: string | null }) => [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown";
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

/** Current and past members. */
export async function AffiliatesView({ view }: { view: "current" | "past" }) {
  const tab = view;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("profiles").select("id, first_name, last_name, email, role, created_at, unpaid_since, removed_at, onboarded_at").in("role", ["member", "admin"]).not("onboarded_at", "is", null).order("first_name").limit(2000);
  const all = (data ?? []) as P[];
  const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const cutoff = twoMonthsAgo.toISOString().slice(0, 10);
  const isPast = (p: P) => !!p.removed_at || (!!p.unpaid_since && p.unpaid_since <= cutoff);
  const current = all.filter((p) => !isPast(p));
  const past = all.filter(isPast);
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
                  <td>{tab === "past" ? (p.removed_at ? "Removed" : `Unpaid since ${p.unpaid_since}`) : <Link href={`/admin/people?view=leads&member=${p.id}`}>See their leads</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
