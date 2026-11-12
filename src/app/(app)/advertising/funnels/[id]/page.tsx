import { notFound } from "next/navigation";
import { FunnelEditor, type EditorStep } from "@/components/funnels/FunnelEditor";
import { requirePlan } from "@/lib/auth/guards";
import { sanitizePage } from "@/lib/funnels/types";

export const instant = false;
export const metadata = { title: "Edit funnel" };

type Props = PageProps<"/advertising/funnels/[id]">;

export default async function EditFunnelPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { session, supabase } = await requirePlan(97);
  const [{ data: funnel }, { data: steps }] = await Promise.all([
    supabase.from("funnels").select("id, name, slug, owner_id").eq("id", id).maybeSingle(),
    supabase.from("funnel_steps").select("id, name, slug, position, page").eq("funnel_id", id).order("position"),
  ]);
  if (!funnel || funnel.owner_id !== session.user.id || !steps?.length) notFound();
  const list: EditorStep[] = steps.map((s) => ({ id: s.id, name: s.name, slug: s.slug, position: s.position, page: sanitizePage(s.page) }));
  return <FunnelEditor funnel={{ id: funnel.id, name: funnel.name, slug: funnel.slug }} steps={list} userId={session.user.id} username={session.profile.username ?? null} />;
}
