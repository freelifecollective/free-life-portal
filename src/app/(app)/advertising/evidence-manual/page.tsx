import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { EvidenceCard } from "@/components/resources/EvidenceCard";
import { EvidenceFilters } from "@/components/resources/EvidenceFilters";
import { requireMember } from "@/lib/auth/guards";
import { RANKS, STORY_TYPES, storyLabel } from "@/lib/resources/kinds";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Evidence Manual" };

type Row = { id: string; name: string; rank: string; story_type: string; story: string; photo_url: string | null };

export default async function EvidenceManualPage(props: PageProps<"/advertising/evidence-manual">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const rank = (RANKS as readonly string[]).includes(one(sp.rank)) ? one(sp.rank) : "";
  const story = STORY_TYPES.some(([v]) => v === one(sp.story)) ? one(sp.story) : "";
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  if (!supabase) return <><PageHeading>Evidence Manual</PageHeading><p className="page-lede">This needs the database, which preview mode does not have.</p></>;
  let q = supabase.from("evidence_stories").select("id, name, rank, story_type, story, photo_url").order("name").limit(1000);
  if (rank) q = q.eq("rank", rank);
  if (story) q = q.eq("story_type", story);
  const rows = ((await q).data ?? []) as Row[];
  const groups = RANKS.map((r) => ({ rank: r, people: rows.filter((x) => x.rank === r) })).filter((g) => g.people.length > 0);
  return (
    <>
      <PageHeading lede="Real people who have found success. Copy a story or download a picture to share. Highest rank first.">Evidence Manual</PageHeading>
      <EvidenceFilters rank={rank} story={story} />
      {groups.length === 0 ? <p className="card-s" style={{ margin: 0 }}>{rank || story ? "No one matches that yet." : "Nothing here yet. Check back soon!"}</p> : groups.map((g) => (
        <section key={g.rank} style={{ marginTop: 24 }} aria-label={`Rank ${g.rank}`}>
          <h2 className="qh" translate="no">{g.rank}</h2>
          <ul className="ev-grid">
            {g.people.map((p) => <EvidenceCard key={p.id} name={p.name} rank={p.rank} typeLabel={storyLabel(p.story_type)} story={p.story} photo={p.photo_url} />)}
          </ul>
        </section>
      ))}
    </>
  );
}
