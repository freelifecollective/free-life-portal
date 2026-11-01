import { GraphicMaker, type Template } from "@/components/graphics/GraphicMaker";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { cleanLayout } from "@/lib/graphics/layout";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const instant = false;
export const metadata = { title: "Graphic maker" };

export default async function GraphicMakerPage() {
  const { session, supabase } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  if (!supabase) return <><PageHeading>Graphic maker</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.from("graphic_templates").select("id, title, image_url, layout").order("created_at", { ascending: false });
  const templates: Template[] = ((data ?? []) as { id: string; title: string; image_url: string; layout: unknown }[]).map((r) => ({ id: r.id, title: r.title, image_url: r.image_url, layout: cleanLayout(r.layout) }));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const p = session.profile;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  const link = p.username ? `${host}/${p.username}` : host;
  return (
    <>
      <PageHeading lede="Make a picture with your photo, name and invite link on it, ready to post.">Graphic maker</PageHeading>
      {templates.length === 0 ? <section className="card-s" style={{ maxWidth: 640 }}><p style={{ margin: 0 }}>No templates are ready yet. Check back soon.</p></section> : <GraphicMaker templates={templates} name={name} photoUrl={p.avatar_url ?? null} link={link} />}
    </>
  );
}
