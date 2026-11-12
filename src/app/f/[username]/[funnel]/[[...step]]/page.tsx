import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FunnelForm } from "@/components/funnels/FunnelForm";
import { PageView, fontHref, fontsOf } from "@/components/funnels/render";
import { supabaseConfigured } from "@/lib/env";
import { sanitizePage } from "@/lib/funnels/types";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Props = PageProps<"/f/[username]/[funnel]/[[...step]]">;
type Step = { funnel_id: string; funnel_name: string; step_id: string; step_slug: string; step_name: string; page: unknown; next_slug: string | null };

async function load(params: Props["params"]): Promise<(Step & { base: string }) | null> {
  const { username, funnel, step } = await params;
  if (!supabaseConfigured || !/^[a-z0-9_-]{3,30}$/i.test(username) || !/^[a-z0-9-]{1,50}$/.test(funnel)) return null;
  const slug = step?.[0] ?? null;
  if (slug !== null && (!/^[a-z0-9-]{1,50}$/.test(slug) || step!.length > 1)) return null;
  const { data } = await (await createClient()).rpc("public_funnel_step", { p_username: username, p_funnel: funnel, p_step: slug });
  return data ? { ...(data as Step), base: `/f/${username.toLowerCase()}/${funnel}` } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load(params);
  if (!s) return { title: "Page not found" };
  const page = sanitizePage(s.page);
  return { title: page.settings.title || s.funnel_name };
}

/** A member's funnel page, open to anyone while the member is on Builder or Leader. */
export default async function FunnelPage({ params }: Props) {
  const s = await load(params);
  if (!s) notFound();
  const page = sanitizePage(s.page);
  const next = s.next_slug ? `${s.base}/${s.next_slug}` : null;
  const fonts = fontHref(fontsOf(page));
  return (
    <>
      {fonts ? <link rel="stylesheet" href={fonts} /> : null}
      <PageView page={page} links={{ next, step: (slug) => `${s.base}/${slug}`, form: (el) => <FunnelForm el={el} funnelId={s.funnel_id} stepId={s.step_id} next={next} /> }} />
    </>
  );
}
