import { PageHeading } from "@/components/PageHeading";
import { EvidenceForm } from "@/components/admin/EvidenceForm";
import { requireAdmin } from "@/lib/auth/guards";
import { RANKS, storyLabel } from "@/lib/resources/kinds";
import { deleteEvidence } from "./actions";

export const instant = false;
export const metadata = { title: "Manage Evidence Manual" };

type Row = { id: string; name: string; rank: string; story_type: string };

export default async function ManageEvidencePage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("evidence_stories").select("id, name, rank, story_type").limit(2000);
  const rows = ((data ?? []) as Row[]).sort((a, b) => RANKS.indexOf(a.rank as (typeof RANKS)[number]) - RANKS.indexOf(b.rank as (typeof RANKS)[number]) || a.name.localeCompare(b.name));
  return (
    <>
      <PageHeading lede="Add people to the Evidence Manual. They are shown highest rank first, and members can filter by rank and by kind of story.">Manage Evidence Manual</PageHeading>
      <section className="card-s" style={{ maxWidth: 660 }}><EvidenceForm /></section>
      <h2 className="qh" style={{ marginTop: 28 }}>Everyone added ({rows.length})</h2>
      {rows.length === 0 ? <p className="page-lede">No one yet.</p> : (
        <ul className="admin-list">
          {rows.map((r) => (
            <li key={r.id}>
              <div><strong translate="no">{r.name}</strong><div className="muted-line"><span translate="no">{r.rank}</span> · {storyLabel(r.story_type)}</div></div>
              <form action={deleteEvidence}><input type="hidden" name="id" value={r.id} /><button className="linkbtn" type="submit">Delete</button></form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
