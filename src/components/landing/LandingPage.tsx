import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/calendar/LocalTime";
import { formatInZone } from "@/lib/time";
import { REGISTRATION_GOAL, type PublicCall, type PublicLanding } from "@/lib/landing/types";
import { GoalBar } from "./GoalBar";
import { LandingRegister } from "./LandingRegister";
import { OwnerTools } from "./OwnerTools";
import { SocialButtons } from "./SocialButtons";
import { LANDING as T } from "./content";

type Owner = { userId: string; hasPagePhoto: boolean } | null;

function List({ items, tone }: { items: readonly string[]; tone: "pain" | "fear" | "future" }) {
  return <ul className={`lp-list lp-list-${tone}`}>{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}

/** The funnel: pain, fears, the shift, the other side, what is possible, then a free seat. */
export function LandingPage({ page, call, owner }: { page: PublicLanding; call: PublicCall | null; owner: Owner }) {
  const name = [page.first_name, page.last_name].filter(Boolean).join(" ");
  const initials = (page.first_name.charAt(0) + (page.last_name ?? "").charAt(0)).toUpperCase();
  return (
    <div className="lp">
      <header className="lp-top"><span className="brand">Free Life Collective</span></header>

      <section className="lp-hero">
        <div className="lp-wrap">
          <p className="label">{T.hero.eyebrow}</p>
          <h1>{T.hero.title}</h1>
          <p className="lp-sub">{T.hero.sub}</p>
          <a className="btn primary" href="#join" style={{ textDecoration: "none" }}>{T.hero.cta}</a>
          {call ? <p className="lp-next">Next call: <strong>{formatInZone(new Date(call.starts_at))}</strong> <LocalTime iso={call.starts_at} /></p> : null}
        </div>
      </section>

      <section className="lp-section lp-surface">
        <div className="lp-wrap"><h2>{T.pain.title}</h2><List items={T.pain.items} tone="pain" /></div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap"><h2>{T.fears.title}</h2>
          <ul className="lp-quotes">{T.fears.items.map((t) => <li key={t}>&ldquo;{t}&rdquo;</li>)}</ul>
          <p className="lp-lead">{T.fears.after}</p></div>
      </section>

      <section className="lp-section lp-dark">
        <div className="lp-wrap lp-center"><h2>{T.shift.title}</h2>{T.shift.body.map((p) => <p key={p} className="lp-lead">{p}</p>)}</div>
      </section>

      <section className="lp-section lp-surface">
        <div className="lp-wrap"><h2>{T.future.title}</h2><List items={T.future.items} tone="future" /></div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap"><h2>{T.possible.title}</h2><p className="lp-lead">{T.possible.body}</p>
          <ul className="lp-list lp-list-future">{T.possible.youGet.map((t) => <li key={t}>{t}</li>)}</ul></div>
      </section>

      <section className="lp-section lp-tint" id="join">
        <div className="lp-wrap lp-join">
          <div className="lp-join-main">
            <h2>{T.join.title}</h2>
            {call ? (
              <>
                <p className="lp-call-title">{call.title}</p>
                <p className="lp-call-time">{formatInZone(new Date(call.starts_at))} · {call.duration_minutes} min <LocalTime iso={call.starts_at} /></p>
                {call.description ? <p className="lp-desc">{call.description}</p> : null}
                <p className="lp-sub" style={{ margin: "14px 0 18px" }}>{T.join.sub}</p>
                <LandingRegister username={page.username} callId={call.id} />
              </>
            ) : <p className="lp-lead">The next call is being scheduled. Check back soon.</p>}
          </div>
          {call ? <div className="lp-join-bar"><GoalBar callId={call.id} initial={call.registered} goal={REGISTRATION_GOAL} /></div> : null}
        </div>
      </section>

      <section className="lp-section lp-surface">
        <div className="lp-wrap"><h2>Questions</h2>
          <dl className="lp-faq">{T.faq.map((f) => <div key={f.q}><dt>{f.q}</dt><dd>{f.a}</dd></div>)}</dl></div>
      </section>

      <section className="lp-section lp-invited" aria-labelledby="invited-by">
        <div className="lp-wrap lp-center">
          <p id="invited-by" className="label">{T.invitedBy}</p>
          <Avatar url={page.photo_url} initials={initials} size={96} label={`${name}, who invited you`} />
          <p className="lp-invitee">{name}</p>
          <SocialButtons instagram={page.instagram} facebook={page.facebook} />
          {owner ? <OwnerTools userId={owner.userId} instagram={page.instagram} facebook={page.facebook} hasPagePhoto={owner.hasPagePhoto} /> : null}
        </div>
      </section>

      <footer className="lp-foot"><div className="lp-wrap"><p>{T.disclaimer}</p><p>&copy; Free Life Collective</p></div></footer>
    </div>
  );
}
