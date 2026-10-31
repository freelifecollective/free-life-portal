import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";
import { adviseLanguages, countryName, isCountryCode, languageName, languageOf, SUPPORTED_LANGS, type CountryRow } from "@/lib/countries";

export const instant = false;
export const metadata = { title: "Members by country" };

export default async function CountriesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_country_counts");
  const rows = ((data ?? []) as CountryRow[]).map((r) => ({ country: r.country, members: Number(r.members), leads: Number(r.leads) }));
  const known = rows.filter((r) => r.country && isCountryCode(r.country));
  const none = rows.find((r) => !r.country);
  const total = known.reduce((n, r) => n + r.members, 0) + (none?.members ?? 0);
  const advice = adviseLanguages(rows);
  const list = [...known].sort((a, b) => b.members - a.members || b.leads - a.leads || countryName(a.country!).localeCompare(countryName(b.country!)));

  return (
    <>
      <PageHeading lede="How many members live in each country, taken from the country they chose in their profile or on the Water Share Map.">Members by country</PageHeading>
      <section className="card-s" style={{ maxWidth: 680, marginBottom: 24 }} aria-label="Languages to consider">
        <h2 className="qh" style={{ marginTop: 0 }}>Languages to add next</h2>
        <p className="when" style={{ marginTop: 0 }}>The portal can be switched to {SUPPORTED_LANGS.map((l) => languageName(l)).join(", ")}. Here are other languages our members speak.</p>
        {advice.length === 0 ? <p style={{ margin: 0 }}>Nothing to add right now. Everyone who has told us where they live is covered by the languages we have.</p> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {advice.map((a) => (
              <li key={a.lang} style={{ marginBottom: 8 }}>
                <strong>{a.name}</strong>: {a.members} {a.members === 1 ? "member" : "members"} ({a.countries.map((c) => `${countryName(c.code)} ${c.members}`).join(", ")}).{" "}
                {a.recommended ? <b>Recommended: add a {a.name} language toggle.</b> : <span className="when">Keep an eye on it.</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th scope="col">Country</th><th scope="col">Language</th><th scope="col">Members</th><th scope="col">Leads</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.country}><td>{countryName(r.country!)}</td><td>{languageName(languageOf(r.country!))}{SUPPORTED_LANGS.includes(languageOf(r.country!)) ? "" : " (not in the portal yet)"}</td><td>{r.members}</td><td>{r.leads}</td></tr>
            ))}
            {none ? <tr><td><em>Has not said yet</em></td><td /><td>{none.members}</td><td>{none.leads}</td></tr> : null}
            <tr><td><strong>All members</strong></td><td /><td><strong>{total}</strong></td><td /></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
