import { PageHeading } from "@/components/PageHeading";
import { InviteForm } from "@/components/admin/InviteForm";
import { AffiliatesView } from "@/components/admin/AffiliatesView";
import { LeadsView } from "@/components/admin/LeadsView";
import { CountriesView } from "@/components/admin/CountriesView";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { removeInvite } from "./actions";

export const instant = false;
export const metadata = { title: "Members and Leads" };

type Person = { id: string; first_name: string | null; last_name: string | null; username: string | null; email: string | null; role: "downline" | "lead" | "member" | "admin"; onboarded_at: string | null; unpaid_since: string | null; removed_at: string | null };
type Invite = { email: string; role: string; note: string | null; claimed_at: string | null; created_at: string };

export default async function PeoplePage(props: PageProps<"/admin/people">) {
  const sp = await props.searchParams;
  const asked = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const view = (asked === "by" ? "leads" : VIEWS.some(([v]) => v === asked) ? asked : "people") as View;
  const member = Array.isArray(sp.member) ? sp.member[0] : sp.member;
  const { supabase } = await requireAdmin();
  if (view === "countries") return <PeopleShell view={view}><CountriesView /></PeopleShell>;
  if (view === "leads") return <PeopleShell view={view}><LeadsView member={member} /></PeopleShell>;
  if (view !== "people") return <PeopleShell view={view}><AffiliatesView view={view} /></PeopleShell>;
  const [people, invites, memberInvites] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, username, email, role, onboarded_at, unpaid_since, removed_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("signup_allowlist").select("email, role, note, claimed_at, created_at").is("claimed_at", null).order("created_at", { ascending: false }).limit(300),
    supabase.from("signup_allowlist").select("email, created_by, created_at, claimed_at, note").eq("role", "member").order("created_at", { ascending: false }).limit(300),
  ]);
  const ppl = (people.data ?? []) as Person[];
  const waiting = (invites.data ?? []) as Invite[];
  const nameOf = new Map(ppl.map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown"]));
  const byEmail = new Map(ppl.map((p) => [(p.email ?? "").toLowerCase(), p]));
  const given = (memberInvites.data ?? []) as { email: string; created_by: string | null; created_at: string; claimed_at: string | null; note: string | null }[];

  return (
    <PeopleShell view={view}>
      <p className="page-lede">Only people on this list can create an account. Leads who register for a call are added automatically. Add leads and FLC Members here. <em>If you select to invite them as a member, this bypasses them having to pay a monthly subscription.</em></p>
      <div className="invite-grid">
        <section className="card-s" aria-label="Invite someone">
          <h2 className="qh" style={{ marginTop: 0 }}>Invite someone</h2>
          <InviteForm />
        </section>
        <section aria-label="Members added without paying">
        <h2 className="qh" style={{ marginTop: 0 }}>Members added without paying ({given.length})</h2>
        <p className="page-lede" style={{ marginTop: -6 }}>Everyone invited as a member by an admin, and who invited them, so you can check they are fine to be here.</p>
        {given.length === 0 ? <p className="page-lede" style={{ marginBottom: 0 }}>No one yet.</p> : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>Member</th><th>Email</th><th>Invited by</th><th>Invited on</th><th>Status</th></tr></thead>
              <tbody>
                {given.map((g) => {
                  const person = byEmail.get(g.email.toLowerCase());
                  return (
                    <tr key={g.email}>
                      <td>{person ? [person.first_name, person.last_name].filter(Boolean).join(" ") || "Not finished" : <span className="muted-line">Not signed up yet</span>}</td>
                      <td>{g.email}</td>
                      <td>{g.created_by ? nameOf.get(g.created_by) ?? "An admin" : "Unknown"}</td>
                      <td>{new Date(g.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "short", day: "numeric" })}</td>
                      <td>{g.claimed_at ? "Joined" : "Waiting"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </section>
      </div>

      <div style={{ marginTop: 36 }}>
          <section aria-label="Waiting to sign up">
            <h2 className="qh" style={{ marginTop: 0 }}>Waiting to sign up ({waiting.length})</h2>
            {waiting.length === 0 ? <p className="page-lede" style={{ marginBottom: 0 }}>No one is waiting.</p> : (
              <ul className="admin-list">
                {waiting.map((i) => (
                  <li key={i.email}>
                    <div><strong>{i.email}</strong><div className="muted-line">{i.role}{i.note ? ` · ${i.note}` : ""}</div></div>
                    <form action={removeInvite}><input type="hidden" name="email" value={i.email} /><button className="linkbtn" type="submit">Remove</button></form>
                  </li>
                ))}
              </ul>
            )}
          </section>
      </div>
    </PeopleShell>
  );
}

type View = "people" | "current" | "past" | "leads" | "countries";
const VIEWS: [View, string][] = [["people", "Invites"], ["current", "Current members"], ["past", "Past members"], ["leads", "Leads"], ["countries", "By country"]];

/** One page for everyone: invites and roles, current and past members, leads, each affiliate's people, and where members live. */
function PeopleShell({ view, children }: { view: View; children: React.ReactNode }) {
  return (
    <>
      <PageHeading lede="Everyone in the portal in one place: who is invited, who is a member, who is a lead, and where people live.">Members and Leads</PageHeading>
      <nav className="lead-tabs" aria-label="Which view">
        {VIEWS.map(([v, label]) => <Link key={v} className={"chip" + (view === v ? " on" : "")} href={v === "people" ? "/admin/people" : `/admin/people?view=${v}`}>{label}</Link>)}
      </nav>
      {children}
    </>
  );
}
