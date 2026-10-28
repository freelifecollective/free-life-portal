import { PageHeading } from "@/components/PageHeading";
import { SuggestForm } from "@/components/financing/SuggestForm";
import { requireMember } from "@/lib/auth/guards";
import { listApproved, mySuggestions } from "@/lib/financing/queries";

export const instant = false;
export const metadata = { title: "Financing Options" };

export default async function FinancingPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Financing Options</PageHeading><p className="page-lede">This needs the database.</p></>;
  const role = session.profile.role;
  const [options, mine] = await Promise.all([listApproved(supabase), role === "lead" ? Promise.resolve([]) : mySuggestions(supabase, session.user.id)]);
  return (
    <>
      <PageHeading lede="Different ways to find the funds to get your business started.">Financing Options</PageHeading>
      <div className="settings" style={{ maxWidth: 760 }}>
        {options.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>No options have been added yet. Check back soon.</p></section> : options.map((o) => (
          <article key={o.id} className="card-s">
            <h2 className="qh" style={{ margin: "0 0 8px" }}>{o.title}</h2>
            <p className="post-body" style={{ margin: "0 0 10px" }}>{o.description}</p>
            {o.link ? <a className="btn small" href={o.link} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration: "none" }}>Learn more</a> : null}
          </article>
        ))}
        {role !== "lead" ? <SuggestForm isAdmin={false} /> : null}
        {mine.length ? (
          <section className="card-s">
            <h2 className="qh" style={{ marginTop: 0 }}>Your suggestions</h2>
            <ul className="rs-mine">{mine.map((m) => <li key={m.id}><span>{m.title}</span><span className={"rs-status " + m.status}>{m.status === "pending" ? "Waiting for review" : "Declined"}{m.review_note ? `: ${m.review_note}` : ""}</span></li>)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
