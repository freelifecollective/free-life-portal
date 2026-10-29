"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseBuddy, setBuddyStatus } from "@/app/(app)/buddy/actions";
import { Avatar } from "@/components/Avatar";
import { BuddyDialog } from "./BuddyDialog";

export type MatchCard = { member_id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null; score: number; reasons: string[]; is_top: boolean };
const nameOf = (m: Pick<MatchCard, "first_name" | "last_name">) => [m.first_name, m.last_name].filter(Boolean).join(" ") || "Member";

function Card({ m, compact }: { m: MatchCard; compact: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <article className="card-s bq-match">
      <div className="who"><Avatar url={m.avatar_url} initials={nameOf(m).charAt(0).toUpperCase()} size={compact ? 40 : 56} /><span className="who-name"><strong>{nameOf(m)}</strong><span className="when">{m.score}% match</span></span></div>
      {!compact && m.reasons.length ? <ul className="bq-why">{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
      <div className="rs-actions" style={{ marginTop: 10 }}>
        <Link className="btn small primary" href={`/messages/${m.username}?draft=ab`} style={{ textDecoration: "none" }}>Say hello</Link>
        <button type="button" className="btn small" disabled={pending} onClick={() => start(async () => { setError(""); const r = await chooseBuddy(m.member_id); if (!r.ok) setError(r.error ?? "That did not work."); else router.refresh(); })}>Choose as my AB</button>
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
    </article>
  );
}

/** Your results, or where you stand if you are not in the pool. */
export function BuddyHome({ status, top, others, buddy, rank }: {
  status: string; top: MatchCard[]; others: MatchCard[]; buddy: Pick<MatchCard, "first_name" | "last_name" | "username" | "avatar_url"> | null; rank: string;
}) {
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [dlg, setDlg] = useState(false);
  const [pending, start] = useTransition();
  const leave = (s: "paused" | "has_ab") => start(async () => { await setBuddyStatus(s); router.refresh(); });

  if (status !== "in_pool") {
    return (
      <>
        <section className="card-s" style={{ maxWidth: 560 }}>
          {status === "matched" && buddy ? (
            <>
              <h2 className="qh" style={{ marginTop: 0 }}>Your accountability buddy</h2>
              <div className="who"><Avatar url={buddy.avatar_url} initials={nameOf(buddy).charAt(0).toUpperCase()} size={56} /><strong>{nameOf(buddy)}</strong></div>
              <p style={{ margin: "12px 0 0" }}><Link className="btn small primary" href={`/messages/${buddy.username}`} style={{ textDecoration: "none" }}>Message {buddy.first_name}</Link></p>
            </>
          ) : <p style={{ margin: 0 }}>{status === "has_ab" ? "You told us you already have an accountability buddy." : "You are not looking for an accountability buddy right now."}</p>}
          <p style={{ margin: "16px 0 0" }}><button type="button" className="btn primary" onClick={() => setDlg(true)}>{status === "matched" ? "Find a new Accountability Buddy" : "Find an Accountability Buddy"}</button></p>
        </section>
        <BuddyDialog kind="return" rank={rank} open={dlg} onClose={() => setDlg(false)} />
      </>
    );
  }
  return (
    <div className="settings" style={{ maxWidth: 820 }}>
      <h2 className="qh" style={{ margin: 0 }}>Your Top 5 Matches</h2>
      {top.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>No close matches yet. New members join the pool all the time, so check back soon. You can also look at everyone who is looking below.</p></section> : top.map((m) => <Card key={m.member_id} m={m} compact={false} />)}
      <div>
        <button type="button" className="btn" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Hide other members" : "See other members looking for an AB"}</button>
        {more ? (others.length ? <div className="settings" style={{ marginTop: 14 }}>{others.map((m) => <Card key={m.member_id} m={m} compact />)}</div> : <p className="when" style={{ marginTop: 10 }}>No one else is looking right now.</p>) : null}
      </div>
      <div className="bq-pills" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="bq-pill" disabled={pending} onClick={() => leave("paused")}>I am not currently looking for an AB</button>
        <button type="button" className="bq-pill" disabled={pending} onClick={() => leave("has_ab")}>I already have an AB</button>
        <Link className="bq-pill" href="/buddy?edit=1" style={{ textDecoration: "none" }}>Change my answers</Link>
      </div>
    </div>
  );
}
