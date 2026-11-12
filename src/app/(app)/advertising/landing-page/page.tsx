import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { CopyInvite } from "@/components/dashboard/CopyInvite";
import { LandingCustomizer } from "@/components/landing/LandingCustomizer";
import { VideoChoice } from "@/components/landing/VideoChoice";
import type { LandingCopy } from "@/components/landing/content";
import { requireMember } from "@/lib/auth/guards";
import { planAtLeast } from "@/lib/plans";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Landing Page" };

type Mine = { copy: LandingCopy | null; video_url: string | null; poster_url: string | null; video_choice: "standard" | "coach" };

export default async function LandingPageTab() {
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  const username = session.profile.username;
  const builder = planAtLeast(session.profile, 97);

  let mine: Mine | null = null;
  let coach: { coach_first_name: string | null; coach_last_name: string | null } | null = null;
  if (supabase) {
    const [{ data: row }, { data: c }] = await Promise.all([
      supabase.from("landing_pages").select("copy, video_url, poster_url, video_choice").eq("member_id", session.user.id).maybeSingle<Mine>(),
      builder ? Promise.resolve({ data: null }) : supabase.rpc("my_coach_video"),
    ]);
    mine = row ?? null;
    coach = (c as typeof coach) ?? null;
  }
  const coachName = coach ? [coach.coach_first_name, coach.coach_last_name].filter(Boolean).join(" ") : "";

  return (
    <>
      <PageHeading lede="This is the page your leads see when you send them your link. Everything they do on it is tracked to you.">Landing Page</PageHeading>
      <PlacedDocs placement="landing" />
      {!username ? <p className="card-s" style={{ margin: 0 }}>Your page is not ready yet. Choose a username in your profile settings and it will appear here.</p> : (
        <>
          <div className="lp-bar">
            <CopyInvite username={username} />
            <Link className="btn" href={`/${username}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Open in a new tab</Link>
            <Link className="linkbtn" href="/settings">Change my page photo and details</Link>
          </div>
          {builder && supabase ? (
            <LandingCustomizer userId={session.user.id} copy={mine?.copy ?? null} videoUrl={mine?.video_url ?? null} posterUrl={mine?.poster_url ?? null} />
          ) : (
            <>
              {coach ? <VideoChoice choice={mine?.video_choice ?? "standard"} coachName={coachName} /> : null}
              <p className="lpc-upsell">Want your own words, pictures and video on this page? <Link href="/plans?plan=97">See the Builder plan</Link></p>
            </>
          )}
          <div className="lp-frame"><iframe src={`/${username}`} title="Your landing page" loading="lazy" /></div>
        </>
      )}
    </>
  );
}
