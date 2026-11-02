import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { bySlug } from "@/lib/resources/kinds";
import { isAffiliate } from "@/lib/roles";

export const instant = false;

type Item = { id: string; title: string; description: string | null; url: string; image_url: string | null };

export default async function ResourcesPage(props: PageProps<"/resources/[kind]">) {
  const { kind } = await props.params;
  const tab = bySlug(kind);
  if (!tab) notFound();
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  if (!supabase) return <><PageHeading>{tab.label}</PageHeading><p className="page-lede">This needs the database, which preview mode does not have.</p></>;
  const { data } = await supabase.from("resource_items").select("id, title, description, url, image_url").eq("category", tab.category).order("created_at", { ascending: false }).limit(500);
  const items = (data ?? []) as Item[];
  return (
    <>
      <PageHeading lede={tab.lede}>{tab.label}</PageHeading>
      {items.length === 0 ? <p className="card-s" style={{ margin: 0 }}>Nothing here yet. Check back soon!</p> : (
        <ul className="res-grid">
          {items.map((i) => (
            <li key={i.id} className="res-card">
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="res-link">
                {i.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="res-img" src={i.image_url} alt="" loading="lazy" />
                ) : <span className="res-img res-fallback" aria-hidden="true">✦</span>}
                <span className="res-title" translate="no">{i.title}</span>
                {i.description ? <span className="res-desc" translate="no">{i.description}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
