import { PageHeading } from "@/components/PageHeading";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireAdmin } from "@/lib/auth/guards";
import { RESOURCE_TABS } from "@/lib/resources/kinds";
import { deleteResource } from "./actions";

export const instant = false;
export const metadata = { title: "Manage resources" };

type Item = { id: string; category: string; title: string; url: string };

export default async function ManageResourcesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("resource_items").select("id, category, title, url").order("created_at", { ascending: false }).limit(1000);
  const items = (data ?? []) as Item[];
  return (
    <>
      <PageHeading lede="Add books, pictures and videos, product information and Canva templates to the Resources section. Each one is a link that opens when someone taps it.">Manage resources</PageHeading>
      <section className="card-s" style={{ maxWidth: 620 }}><ResourceForm /></section>
      {RESOURCE_TABS.map((t) => {
        const mine = items.filter((i) => i.category === t.category);
        return (
          <section key={t.category} style={{ marginTop: 28 }}>
            <h2 className="qh">{t.label} <span className="muted-line">({t.section === "advertising" ? "Advertising" : "Resources"}) · {mine.length}</span></h2>
            {mine.length === 0 ? <p className="page-lede">Nothing yet.</p> : (
              <ul className="admin-list">
                {mine.map((i) => (
                  <li key={i.id}>
                    <div><strong translate="no">{i.title}</strong><div className="muted-line" translate="no">{i.url}</div></div>
                    <form action={deleteResource}><input type="hidden" name="id" value={i.id} /><button className="linkbtn" type="submit">Delete</button></form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
