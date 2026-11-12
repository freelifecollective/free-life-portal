import { UserText } from "@/components/UserText";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/calendar/LocalTime";
import { callLength } from "@/lib/calls/length";
import { SpeakerBubbles } from "@/components/calendar/SpeakerBubbles";
import { formatInZone } from "@/lib/time";
import type { PublicCall, PublicLanding } from "@/lib/landing/types";
import { LandingTracker } from "./LandingTracker";
import { LandingRegister } from "./LandingRegister";
import { OwnerTools } from "./OwnerTools";
import { SocialButtons } from "./SocialButtons";
import { HeroVideo } from "./HeroVideo";
import { Marquee } from "./Marquee";
import { LANDING as T, wordsFor } from "./content";
import { LanguagePicker } from "@/components/LanguagePicker";

type Owner = { userId: string; hasPagePhoto: boolean } | null;

/** The page a lead lands on: watch the video, ask for the rest of it, see what others say. */
export function LandingPage({ page, call, owner }: { page: PublicLanding; call: PublicCall | null; owner: Owner }) {
  const name = [page.first_name, page.last_name].filter(Boolean).join(" ");
  const initials = (page.first_name.charAt(0) + (page.last_name ?? "").charAt(0)).toUpperCase();
  const w = wordsFor(page.copy);
  /* the member's own words are theirs: the page's translator leaves them as they wrote them */
  const own = (k: keyof NonNullable<PublicLanding["copy"]>) => (page.copy?.[k]?.trim() ? { translate: "no" as const } : {});
  return (
    <div className="lpn">
      <LandingTracker username={page.username} skip={owner !== null} />

      <section className="lpn-hero">
        <div className="lpn-hero-in">
          <p className="lpn-eyebrow" {...own("eyebrow")}>{w.eyebrow}</p>
          <h1 className="lpn-h1"><span {...own("title1")}>{w.title1}</span><br /><em {...own("title2")}>{w.title2}</em></h1>
          <p className="lpn-sub" {...own("sub")}>{w.sub}</p>
          <HeroVideo videoUrl={page.video_url || T.videoEmbedUrl || null} poster={page.poster_url ?? null} cta={w.cta} joinTitle={w.join_title}>
            {call ? (
              <>
                <p className="lp-call-title"><UserText text={call.title} publicCall={{ id: call.id, field: "title" }} /></p>
                <p className="lp-call-time">{formatInZone(new Date(call.starts_at))} · {callLength(call)} <LocalTime iso={call.starts_at} /></p>
                {call.speakers?.length ? <div style={{ margin: "4px 0 12px" }}><SpeakerBubbles speakers={call.speakers} /></div> : null}
                <p className="lp-sub" style={{ margin: "10px 0 16px" }} {...own("join_sub")}>{w.join_sub}</p>
                <LandingRegister username={page.username} callId={call.id} />
              </>
            ) : <p className="lp-lead">Our next call is being scheduled. Check back soon.</p>}
          </HeroVideo>
        </div>
      </section>

      <section className="lpn-proof" aria-label="What others say">
        <p className="lpn-hint">{T.hint}</p>
        <Marquee />
      </section>

      <section className="lpn-invited" aria-labelledby="invited-by">
        <p id="invited-by" className="lpn-eyebrow">{T.invitedBy}</p>
        <Avatar url={page.photo_url} initials={initials} size={88} label={`${name}, who invited you`} />
        <p className="lpn-invitee">{name}</p>
        <SocialButtons instagram={page.instagram} facebook={page.facebook} />
        {owner ? <OwnerTools userId={owner.userId} instagram={page.instagram} facebook={page.facebook} hasPagePhoto={owner.hasPagePhoto} /> : null}
      </section>

      <footer className="lpn-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lpn-seal" src="/icons/icon-192.png" alt="Free Life Collective" width={112} height={112} />
        <div className="lpn-legal">
          <p>{T.legal.rights}<br />{T.legal.links.join(" - ")}</p>
          <p>{T.legal.facebook}</p>
          <p className="lpn-small">{T.legal.earnings}</p>
        </div>
        <div className="login-lang"><LanguagePicker variant="list" /></div>
      </footer>
    </div>
  );
}
