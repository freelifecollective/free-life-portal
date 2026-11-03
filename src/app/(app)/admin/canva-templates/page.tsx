import { PageHeading } from "@/components/PageHeading";
import { CanvaLinksForm, RefreshCanvaNames } from "@/components/admin/CanvaLinksForm";
import { ResourceEditList, type EditItem } from "@/components/admin/ResourceEditList";
import { requireAdmin } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Manage Canva Templates" };

export default async function ManageCanvaPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("resource_items").select("id, title, url, image_url, description").eq("category", "canva").order("created_at", { ascending: false }).limit(1000);
  const items = (data ?? []) as EditItem[];
  return (
    <>
      <PageHeading lede="The templates on Advertising, Canva Templates. Each shows a small preview of the design. Paste more links below, or edit a template to change its name.">Manage Canva Templates</PageHeading>
      <section className="card-s" style={{ maxWidth: 680 }}>
        <h2 className="qh" style={{ marginTop: 0 }}>Add Canva templates</h2>
        <CanvaLinksForm />
        <RefreshCanvaNames />
      </section>
      <h2 className="qh" style={{ marginTop: 28 }}>Templates ({items.length})</h2>
      {items.length === 0 ? <p className="page-lede">Nothing yet.</p> : <ResourceEditList items={items} cards />}
    </>
  );
}
