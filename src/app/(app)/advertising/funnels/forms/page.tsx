import { PageHeading } from "@/components/PageHeading";
import { FunnelTabs } from "@/components/funnels/FunnelTabs";
import { requirePlan } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Forms" };

type Row = { id: string; created_at: string; fields: Record<string, string>; funnels: { name: string } | null };

/** Everyone who filled in a form on one of the member's funnels, newest first. */
export default async function FormsPage() {
  const { session, supabase } = await requirePlan(97);
  const { data } = await supabase.from("funnel_submissions").select("id, created_at, fields, funnels(name)").eq("owner_id", session.user.id).order("created_at", { ascending: false }).limit(500);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <>
      <PageHeading lede="Add a form to any funnel page from the editor. Everyone who fills one in shows up here.">Forms</PageHeading>
      <FunnelTabs current="/advertising/funnels/forms" />
      {rows.length === 0 ? <p className="when">Nobody has filled in a form yet. Add a Form element to a funnel page and share its link.</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">When</th><th scope="col">Funnel</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Phone</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td translate="no">{r.funnels?.name ?? ""}</td>
                  <td translate="no">{[r.fields.first_name, r.fields.last_name].filter(Boolean).join(" ")}</td>
                  <td translate="no">{r.fields.email ?? ""}</td>
                  <td translate="no">{r.fields.phone ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
