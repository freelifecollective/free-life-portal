import { PageHeading } from "@/components/PageHeading";
import { SuggestForm } from "@/components/financing/SuggestForm";
import Link from "next/link";
import { COUNTRIES, countryBySlug, countryValue } from "@/lib/financing/countries";
import { requireMember } from "@/lib/auth/guards";
import { listApproved, mySuggestions } from "@/lib/financing/queries";

export const instant = false;
export const metadata = { title: "Financing Options" };

export default async function FinancingPage(props: PageProps<"/financing">) {
  const sp = await props.searchParams;
  const chosen = countryBySlug(Array.isArray(sp.country) ? sp.country[0] : sp.country);
  const country = countryValue(chosen);
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Financing Options</PageHeading><p className="page-lede">This needs the database.</p></>;
  const role = session.profile.role;
  const [options, mine] = await Promise.all([listApproved(supabase, country), role === "lead" ? Promise.resolve([]) : mySuggestions(supabase, session.user.id)]);
  return (
    <>
      <PageHeading lede={role === "lead" ? "Different ways to find the funds to get your business started." : "Different options to help your leads get started."}>Financing Options</PageHeading>
      <nav className="country-tabs" aria-label="Country">
        {COUNTRIES.map((c) => <Link key={c.slug} href={`/financing?country=${c.slug}`} aria-current={c.slug === chosen.slug ? "page" : undefined}>{c.name}</Link>)}
      </nav>
      <div className="settings" style={{ maxWidth: 760 }}>
        {options.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>No options have been added for {chosen.name} yet. Check back soon.</p></section> : options.map((o) => (
          <article key={o.id} className="card-s">
            <h2 className="qh" style={{ margin: "0 0 8px" }}>{o.title}</h2>
            <p className="post-body" style={{ margin: "0 0 10px" }}>{o.description}</p>
            {o.link ? <a className="btn small" href={o.link} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration: "none" }}>Learn more</a> : null}
          </article>
        ))}
        {role !== "lead" ? <SuggestForm isAdmin={false} country={country} /> : null}
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
