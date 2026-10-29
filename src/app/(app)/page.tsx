import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { LiveBadge } from "@/components/LiveBadge";
import { LocalTime } from "@/components/calendar/LocalTime";
import { requireMember } from "@/lib/auth/guards";
import { listUpcomingCalls, pickFeatured } from "@/lib/calls/queries";
import { AUDIENCE_LABEL, KIND_LABEL } from "@/lib/calls/types";
import { endsAt, formatInZone, nowMs } from "@/lib/time";

export const instant = false; // renders per signed-in member
export const metadata = { title: "Home" };

export default async function HomePage() {
  const { session, supabase } = await requireMember();
  const { profile, mode } = session;
  const next = supabase ? pickFeatured(await listUpcomingCalls(supabase, nowMs())) : null;
  return (
    <>
      <PageHeading lede="This is your home in the Free Life Collective. More of the portal arrives step by step.">
        Welcome, {profile.first_name}
      </PageHeading>
      {supabase ? (
        <section className="card-s" style={{ maxWidth: 460, marginBottom: 20 }} aria-label="Next call">
          <div className="label" style={{ marginBottom: 8 }}>{next && nowMs() >= new Date(next.starts_at).getTime() && nowMs() < endsAt(new Date(next.starts_at), next.duration_minutes).getTime() ? <LiveBadge>LIVE · Happening now</LiveBadge> : "Next call"}</div>
          {next ? (
            <>
              <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20 }}>{next.title}</p>
              <p style={{ margin: 0, fontWeight: 700 }}>{formatInZone(new Date(next.starts_at))}</p>
              <LocalTime iso={next.starts_at} />
              <p className="muted-line" style={{ margin: "6px 0 14px" }}>{KIND_LABEL[next.kind]} · {AUDIENCE_LABEL[next.audience]}</p>
              <Link className="btn" href="/calendar" style={{ textDecoration: "none", height: 44 }}>RSVP on the calendar</Link>
            </>
          ) : (
            <p style={{ margin: 0 }}>No calls are scheduled yet. <Link className="linkbtn" href="/calendar" style={{ padding: 0 }}>Open the calendar</Link></p>
          )}
        </section>
      ) : null}
      <section className="card-s" style={{ maxWidth: 460 }} aria-label="Your profile">
        <ul className="kv">
          <li><span>Username</span><span>@{profile.username}</span></li>
          <li><span>Instagram</span><span>{profile.instagram ? "@" + profile.instagram : "Not added yet"}</span></li>
          <li><span>Facebook</span><span>{profile.facebook ? "@" + profile.facebook : "Not added yet"}</span></li>
        </ul>
        {mode === "preview" ? <p className="status" style={{ marginBottom: 0 }}>Preview mode: nothing here is saved to a real account.</p> : null}
      </section>
    </>
  );
}
