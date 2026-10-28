import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LandingPage } from "@/components/landing/LandingPage";
import { getSession } from "@/lib/auth/session";
import { supabaseConfigured } from "@/lib/env";
import { getNextPublicCall, getPublicLanding } from "@/lib/landing/queries";
import { createClient } from "@/lib/supabase/server";

export const instant = false; // the page is the same for everyone, but the owner sees edit buttons

type Props = PageProps<"/[username]">;

async function load(username: string) {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const page = await getPublicLanding(supabase, username);
  return page ? { supabase, page } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const l = await load(username);
  if (!l) return { title: "Page not found" };
  return {
    title: `Join ${l.page.first_name}'s free community call`,
    description: "A free live call with a community of everyday people building online businesses from home.",
  };
}

async function Content({ params }: Props) {
  const { username } = await params;
  const l = await load(username);
  if (!l) notFound();
  const [call, session] = await Promise.all([getNextPublicCall(l.supabase), getSession()]);
  let owner = null;
  if (session && session.mode === "supabase" && session.user.id === l.page.member_id) {
    const { data } = await l.supabase.from("landing_pages").select("photo_url").eq("member_id", session.user.id).maybeSingle();
    owner = { userId: session.user.id, hasPagePhoto: Boolean(data?.photo_url) };
  }
  return <LandingPage page={l.page} call={call} owner={owner} />;
}

export default function Page(props: Props) {
  return <Suspense fallback={<div style={{ minHeight: "100dvh" }} aria-busy="true" />}><Content {...props} /></Suspense>;
}
