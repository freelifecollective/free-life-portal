import { PageHeading } from "@/components/PageHeading";
import { InviteForm } from "@/components/admin/InviteForm";
import { MilestoneForm } from "@/components/admin/MilestoneForm";
import { requireAdmin } from "@/lib/auth/guards";
import { nowMs, toZonedInput } from "@/lib/time";
import { removeInvite, removeMilestone, setRole, setStanding } from "./actions";

export const instant = false;
export const metadata = { title: "People and invites" };

type Person = { id: string; first_name: string | null; last_name: string | null; username: string | null; email: string | null; role: "lead" | "member" | "admin"; onboarded_at: string | null; unpaid_since: string | null; removed_at: string | null };
type Invite = { email: string; role: string; note: string | null; claimed_at: string | null; created_at: string };

export default async function PeoplePage() {
  const { session, supabase } = await requireAdmin();
  const [people, invites, memberInvites, events] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, username, email, role, onboarded_at, unpaid_since, removed_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("signup_allowlist").select("email, role, note, claimed_at, created_at").is("claimed_at", null).order("created_at", { ascending: false }).limit(300),
    supabase.from("signup_allowlist").select("email, created_by, created_at, claimed_at, note").eq("role", "member").order("created_at", { ascending: false }).limit(300),
    supabase.from("milestone_events").select("id, member_id, kind, happened_on, note").order("created_at", { ascending: false }).limit(15),
  ]);
  const ppl = (people.data ?? []) as Person[];
  const waiting = (invites.data ?? []) as Invite[];
  const nameOf = new Map(ppl.map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown"]));
  const byEmail = new Map(ppl.map((p) => [(p.email ?? "").toLowerCase(), p]));
  const logged = (events.data ?? []) as { id: string; member_id: string; kind: "coaching" | "sale"; happened_on: string; note: string | null }[];
  const affiliates = ppl.filter((p) => (p.role === "member" || p.role === "admin") && p.onboarded_at && !p.removed_at)
    .map((p) => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown" })).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const todayDay = toZonedInput(new Date(nowMs())).slice(0, 10);
  const given = (memberInvites.data ?? []) as { email: string; created_by: string | null; created_at: string; claimed_at: string | null; note: string | null }[];

  return (
    <>
      <PageHeading lede={<>Only people on this list can create an account. Leads who register for a call are added automatically. Add leads and FLC Members here. <em>If you select to invite them as a member, this bypasses them having to pay a monthly subscription.</em></>}>People and invites</PageHeading>
      <section className="card-s" style={{ maxWidth: 680 }} aria-label="Invite someone">
        <h2 className="qh" style={{ marginTop: 0 }}>Invite someone</h2>
        <InviteForm />
      </section>

      <section className="card-s" style={{ maxWidth: 680, marginTop: 24 }} aria-label="Log a coaching call or a sale">
        <h2 className="qh" style={{ marginTop: 0 }}>Log a coaching call or a sale</h2>
        <p className="when" style={{ margin: "0 0 12px" }}>This is what hands out the coaching and sales badges.</p>
        <MilestoneForm members={affiliates} today={todayDay} />
        {logged.length ? (
          <ul className="admin-list" style={{ marginTop: 16 }}>
            {logged.map((e) => (
              <li key={e.id}>
                <div><strong>{nameOf.get(e.member_id) ?? "A member"}</strong><div className="muted-line">{e.kind === "sale" ? "Sale" : "Coaching call"} · {e.happened_on}{e.note ? ` · ${e.note}` : ""}</div></div>
                <form action={removeMilestone}><input type="hidden" name="id" value={e.id} /><button className="linkbtn" type="submit">Remove</button></form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <h2 className="qh" style={{ marginTop: 36 }}>Waiting to sign up ({waiting.length})</h2>
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

      <h2 className="qh" style={{ marginTop: 36 }}>Members added without paying ({given.length})</h2>
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

      <h2 className="qh" style={{ marginTop: 36 }}>People ({ppl.length})</h2>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Username</th><th>Role</th><th>Standing</th></tr></thead>
          <tbody>
            {ppl.map((p) => (
              <tr key={p.id}>
                <td>{[p.first_name, p.last_name].filter(Boolean).join(" ") || <span className="muted-line">Not finished</span>}</td>
                <td>{p.email}</td>
                <td>{p.username ? "@" + p.username : ""}</td>
                <td>
                  {p.id === session.user.id ? <span>{p.role} (you)</span> : (
                    <form action={setRole} className="inline-form">
                      <input type="hidden" name="id" value={p.id} />
                      <label className="sr-only" htmlFor={`role-${p.id}`}>Role for {p.email}</label>
                      <select id={`role-${p.id}`} name="role" defaultValue={p.role}><option value="lead">lead</option><option value="member">member</option><option value="admin">admin</option></select>
                      <button className="btn small" type="submit">Save</button>
                    </form>
                  )}
                </td>
                <td>
                  {p.role === "lead" || p.id === session.user.id ? null : (
                    <form action={setStanding} className="inline-form">
                      <input type="hidden" name="id" value={p.id} />
                      <label className="sr-only" htmlFor={`since-${p.id}`}>Date {p.email} stopped paying</label>
                      <input id={`since-${p.id}`} type="date" name="unpaid_since" defaultValue={p.unpaid_since ?? ""} title="Date they stopped paying (leave empty if paying)" />
                      <label className="check"><input type="checkbox" name="removed" defaultChecked={!!p.removed_at} /> Removed</label>
                      <button className="btn small" type="submit">Save</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
