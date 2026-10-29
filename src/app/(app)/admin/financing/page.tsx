import { PageHeading } from "@/components/PageHeading";
import { FinancingRow } from "@/components/admin/FinancingRow";
import { SuggestForm } from "@/components/financing/SuggestForm";
import { requireAdmin } from "@/lib/auth/guards";
import { authorsById } from "@/lib/chats/queries";
import { listAll } from "@/lib/financing/queries";

export const instant = false;
export const metadata = { title: "Financing submissions" };

export default async function FinancingAdmin() {
  const { supabase } = await requireAdmin();
  const all = await listAll(supabase);
  const authors = await authorsById(supabase, all.map((o) => o.submitted_by).filter((x): x is string => !!x));
  const who = (o: (typeof all)[number]) => (o.submitted_by ? authors.get(o.submitted_by)?.name ?? "A member" : "Admin");
  const pending = all.filter((o) => o.status === "pending");
  const rest = all.filter((o) => o.status !== "pending");
  return (
    <>
      <PageHeading>Financing submissions</PageHeading>
      <h2 className="qh">Waiting for review ({pending.length})</h2>
      {pending.length === 0 ? <p className="page-lede">Nothing waiting.</p> : pending.map((o) => <FinancingRow key={o.id} o={o} who={who(o)} />)}
      <h2 className="qh" style={{ marginTop: 36 }}>Add one yourself</h2>
      <div style={{ maxWidth: 620 }}><SuggestForm isAdmin /></div>
      {rest.length ? <h2 className="qh" style={{ marginTop: 36 }}>Already reviewed</h2> : null}
      {rest.map((o) => <FinancingRow key={o.id} o={o} who={who(o)} />)}
    </>
  );
}
