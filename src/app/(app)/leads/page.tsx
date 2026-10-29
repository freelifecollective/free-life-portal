import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { parseRange } from "@/lib/dashboard/range";
import { formatInZone, nowMs } from "@/lib/time";
import { redirect } from "next/navigation";

export const instant = false;
export const metadata = { title: "My leads" };

type Lead = {
  email: string; first_name: string | null; last_name: string | null; filled_at: string; registered_at: string | null;
  calls: { call_id: string; title: string; starts_at: string; attended: boolean; replay: boolean }[];
};

const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

export default async function LeadsPage(props: PageProps<"/leads">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") redirect("/");
  const range = parseRange(one(sp.from), one(sp.to), nowMs());
  const { data } = await supabase.rpc("my_leads", { p_from: range.fromIso, p_to: range.toIso });
  const all = (data ?? []) as Lead[];
  const registeredOnly = one(sp.show) === "registered";
  const leads = registeredOnly ? all.filter((l) => l.registered_at) : all;
  const regCount = all.filter((l) => l.registered_at).length;
  const q = `from=${range.from}&to=${range.to}`;

  return (
    <>
      <p style={{ margin: "0 0 8px" }}><Link className="doc-back" href={`/?${q}`}>← Back to Home</Link></p>
      <PageHeading lede={`People who filled in the form on your page, ${range.from} to ${range.to}.`}>My leads</PageHeading>
      <nav className="lead-tabs" aria-label="Which leads">
        <Link className={"chip" + (!registeredOnly ? " on" : "")} href={`/leads?${q}`}>Form fill-outs · {all.length}</Link>
        <Link className={"chip" + (registeredOnly ? " on" : "")} href={`/leads?${q}&show=registered`}>Registered in the portal · {regCount}</Link>
      </nav>
      {leads.length === 0 ? (
        <section className="card-s" style={{ maxWidth: 560 }}><p style={{ margin: 0 }}>{registeredOnly ? "Nobody from this period has created a portal account yet." : "Nobody has filled in your form in this period. Try a longer date range."}</p></section>
      ) : (
        <ul className="lead-list">
          {leads.map((l) => (
            <li key={l.email}>
              <div className="lead-top">
                <strong>{[l.first_name, l.last_name].filter(Boolean).join(" ") || l.email}</strong>
                <span className={"pill" + (l.registered_at ? " yes" : "")}>{l.registered_at ? `In the portal since ${day(l.registered_at)}` : "Not in the portal yet"}</span>
              </div>
              <div className="when">{l.email} · Filled in your form {day(l.filled_at)}</div>
              <div className="lead-calls">
                {l.calls.map((c) => (
                  <div key={c.call_id} className="lead-call">
                    <span><strong>{c.title}</strong> · {formatInZone(new Date(c.starts_at)).split(",").slice(0, 2).join(",")}</span>
                    <span className={"pill" + (c.attended ? " yes" : "")}>{c.attended ? "Attended live ✓" : "Did not attend live"}</span>
                    <span className={"pill" + (c.replay ? " yes" : "")}>{c.replay ? "Watched the replay ✓" : "No replay watched"}</span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
