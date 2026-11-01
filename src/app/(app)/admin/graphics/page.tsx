import { TemplateAdmin } from "@/components/graphics/TemplateAdmin";
import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";
import { cleanLayout } from "@/lib/graphics/layout";
import { headers } from "next/headers";

export const instant = false;
export const metadata = { title: "Manage graphics" };

export default async function ManageGraphicsPage() {
  const { session, supabase } = await requireAdmin();
  const { data } = await supabase.from("graphic_templates").select("id, title, image_url, layout, published").order("created_at", { ascending: false });
  const rows = ((data ?? []) as { id: string; title: string; image_url: string; layout: unknown; published: boolean }[]).map((r) => ({ ...r, layout: cleanLayout(r.layout) }));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const p = session.profile;
  return (
    <>
      <PageHeading lede="Template pictures for the Graphic maker. You see your own name, photo and link as the example while you place things.">Manage graphics</PageHeading>
      <TemplateAdmin rows={rows} sample={{ name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Your Name", photoUrl: p.avatar_url ?? null, link: p.username ? `${host}/${p.username}` : host }} />
    </>
  );
}
