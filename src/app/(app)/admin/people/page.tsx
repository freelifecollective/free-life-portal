import { PageHeading } from "@/components/PageHeading";
import { InviteForm } from "@/components/admin/InviteForm";
import { requireAdmin } from "@/lib/auth/guards";
import { removeInvite, setRole } from "./actions";

export const instant = false;
export const metadata = { title: "People and invites" };

type Person = { id: string; first_name: string | null; last_name: string | null; username: string | null; email: string | null; role: "lead" | "member" | "admin"; onboarded_at: string | null };
type Invite = { email: string; role: string; note: string | null; claimed_at: string | null; created_at: string };

export default async function PeoplePage() {
  const { session, supabase } = await requireAdmin();
  const [people, invites] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, username, email, role, onboarded_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("signup_allowlist").select("email, role, note, claimed_at, created_at").is("claimed_at", null).order("created_at", { ascending: false }).limit(300),
  ]);
  const ppl = (people.data ?? []) as Person[];
  const waiting = (invites.data ?? []) as Invite[];

  return (
    <>
      <PageHeading lede="Only people on this list can create an account. Leads who register for a call are added automatically. Invite members or coaches here.">People and invites</PageHeading>
      <section className="card-s" style={{ maxWidth: 680 }} aria-label="Invite someone">
        <h2 className="qh" style={{ marginTop: 0 }}>Invite someone</h2>
        <InviteForm />
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

      <h2 className="qh" style={{ marginTop: 36 }}>People ({ppl.length})</h2>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Username</th><th>Role</th></tr></thead>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
