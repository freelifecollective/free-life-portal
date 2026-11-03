import { PageHeading } from "@/components/PageHeading";
import { ResourceEditList, type EditItem } from "@/components/admin/ResourceEditList";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireAdmin } from "@/lib/auth/guards";
import { RESOURCE_TABS } from "@/lib/resources/kinds";

export const instant = false;
export const metadata = { title: "Manage resources" };

type Item = EditItem & { category: string };

export default async function ManageResourcesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("resource_items").select("id, category, title, url, image_url, description").neq("category", "canva").order("created_at", { ascending: false }).limit(1000);
  const items = (data ?? []) as Item[];
  return (
    <>
      <PageHeading lede="Add books, pictures and videos, and product information. Each one is a link that opens when someone taps it. Canva templates have their own page, Manage Canva Templates.">Manage resources</PageHeading>
      <section className="card-s" style={{ maxWidth: 620 }}><ResourceForm /></section>
      {RESOURCE_TABS.filter((t) => t.category !== "canva").map((t) => {
        const mine = items.filter((i) => i.category === t.category);
        return (
          <section key={t.category} style={{ marginTop: 28 }}>
            <h2 className="qh">{t.label} <span className="muted-line">({t.section === "advertising" ? "Advertising" : "Resources"}) · {mine.length}</span></h2>
            {mine.length === 0 ? <p className="page-lede">Nothing yet.</p> : <ResourceEditList items={mine} />}
          </section>
        );
      })}
    </>
  );
}
