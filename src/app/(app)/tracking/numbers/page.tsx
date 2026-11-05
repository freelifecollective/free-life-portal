import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { requireMember } from "@/lib/auth/guards";
import { loadBoards, loadTeam } from "@/lib/tracking/queries";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Know Your Numbers" };

export default async function NumbersPage() {
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  if (!supabase) return <><PageHeading>Know Your Numbers</PageHeading><p className="page-lede">This needs the database.</p></>;
  const [boards, team, { count: affiliated }] = await Promise.all([
    loadBoards(supabase), loadTeam(supabase),
    supabase.from("lead_cards").select("id", { count: "exact", head: true }).not("affiliated_at", "is", null),
  ]);
  const onBoards = boards.reduce((n, b) => n + b.lists.reduce((m, l) => m + l.cards.length, 0), 0);
  const inPortal = boards.filter((b) => b.kind === "portal").reduce((n, b) => n + b.lists.reduce((m, l) => m + l.cards.length, 0), 0);
  const active = team.filter((m) => m.status === "active").length;
  const tiles: [string, number][] = [["Leads on your boards", onBoards], ["Leads in the FLC Portal", inPortal], ["Became affiliates", affiliated ?? 0], ["On your team", team.length], ["Active in FLC", active]];
  return (
    <>
      <PageHeading lede="The numbers behind your business, taken from Lead Tracking and My Team.">Know Your Numbers</PageHeading>
      <PlacedDocs placement="numbers" />
      <div className="kn-tiles">{tiles.map(([label, n]) => <div key={label} className="card-s kn-tile"><b>{n}</b><span>{label}</span></div>)}</div>
      {boards.map((b) => (
        <section key={b.id} style={{ marginTop: 26 }}>
          <h2 className="qh">{b.name}</h2>
          <div className="table-wrap"><table className="admin-table">
            <thead><tr><th scope="col">List</th><th scope="col">Leads</th></tr></thead>
            <tbody>{b.lists.map((l) => <tr key={l.id}><td>{l.name}</td><td>{l.cards.length}</td></tr>)}</tbody>
          </table></div>
        </section>
      ))}
    </>
  );
}
