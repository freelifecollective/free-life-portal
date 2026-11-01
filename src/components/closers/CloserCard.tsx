"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ProfileButton } from "@/components/people/ProfilePopup";
import { closerName, dollars, type CloserCardData } from "@/lib/closers/types";
import { CoverEditor } from "./CoverEditor";
import { HireButton, type ActiveHire } from "./HireButton";

/**
 * A call closer as a card that flips. The front is their cover: a big photo with their name and where they are over it, then their experience and bio.
 * The back is their numbers, with the Hire button. Pressing empty space on the back flips it over to the cover again.
 */
export function CloserCard({ c, me, hire }: { c: CloserCardData; me: string; hire: ActiveHire | null }) {
  const [back, setBack] = useState(false);
  const name = closerName(c);
  const first = c.first_name ?? "them";
  const stars = c.avg_rating ? "★".repeat(Math.round(c.avg_rating)) + "☆".repeat(5 - Math.round(c.avg_rating)) : null;
  const rows: { label: string; value: string; pre?: boolean }[] = [];
  if (c.members_booked > 0) rows.push({ label: "FLC members booked", value: String(c.members_booked) });
  if (c.calls_taken) rows.push({ label: "Calls taken", value: c.calls_taken });
  if (c.price_per_call_cents !== null) rows.push({ label: "Price per call (USD)", value: dollars(c.price_per_call_cents) });
  if (c.price_per_sale) rows.push({ label: "Charge per product sale (USD)", value: c.price_per_sale, pre: true });
  const photo = c.cover_url ?? c.avatar_url;
  const canMessage = !!c.username && c.id !== me;

  /* a press on the white space of the back flips the card back; presses on buttons, links and the hire form do their own thing */
  const backPress = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, label, dialog")) return;
    setBack(false);
  };

  return (
    <article className={"cc-flip" + (back ? " flipped" : "")}>
      <div className="cc-inner">
        <div className="cc-face cc-front" aria-hidden={back} inert={back}>
          <div className="cc-cover" role="button" tabIndex={0} aria-label={`See ${first}'s stats`} onClick={() => setBack(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBack(true); } }}>
            {photo ? <img src={photo} alt={name} /> : <div className="cc-cover-empty"><Avatar url={null} initials={name.charAt(0).toUpperCase()} size={120} /></div>}
            <div className="cc-cover-text">
              <h2>{name}</h2>
              {c.location ? <p className="cc-loc">{c.location}</p> : null}
            </div>
          </div>
          <div className="cc-front-body">
            {c.experience_text ? <p className="cc-exp"><span>Experience</span><b>{c.experience_text}</b></p> : null}
            {c.bio ? <p className="cc-bio">{c.bio}</p> : <p className="cc-bio when">No bio yet.</p>}
            <button type="button" className="cc-flipbtn" onClick={() => setBack(true)}>{`See ${first}'s stats`} <span aria-hidden="true">↻</span></button>
            {c.id === me ? <CoverEditor c={c} /> : null}
          </div>
        </div>
        <div className="cc-face cc-back" aria-hidden={!back} inert={!back} onClick={backPress}>
          <div className="cc-back-top">
            <Avatar url={c.avatar_url} initials={name.charAt(0).toUpperCase()} size={84} />
            <h2 className="pc-name">{name}</h2>
            <p className="pc-sub">Call closer</p>
            {stars ? <p className="pc-sub cc-stars" aria-label={`${c.avg_rating} out of 5`}>{stars}</p> : null}
          </div>
          <div className="pc-card">
            <div className="pc-row pc-plain">
              <div><small>Reviews</small><span>{c.avg_rating ? `${c.avg_rating} · ${c.review_count} ${c.review_count === 1 ? "review" : "reviews"}` : "No reviews yet"}</span></div>
              {c.review_count > 0 ? <ProfileButton id={c.id} view="reviews" className="linkbtn">Read</ProfileButton> : null}
            </div>
            {rows.map((r) => (
              <div className="pc-row pc-plain" key={r.label}><div><small>{r.label}</small><span style={r.pre ? { whiteSpace: "pre-line" } : undefined}>{r.value}</span></div></div>
            ))}
          </div>
          {c.id !== me
            ? <HireButton closerId={c.id} first={first} hire={hire?.closer_id === c.id ? hire : null} otherHire={!!hire && hire.closer_id !== c.id} priceCall={c.price_per_call_cents} priceSale={c.price_per_sale} />
            : <><button type="button" className="btn primary cc-hire" disabled>{`Hire ${first}`}</button><p className="cc-tapback when" style={{ marginTop: -6 }}>This is your own card, so the Hire button is switched off.</p></>}
          {canMessage ? <Link className="linkbtn cc-msg" href={`/messages/${c.username}`}>{`Message ${first}`}</Link> : null}
          <p className="cc-tapback when">Tap the white space to go back</p>
        </div>
      </div>
    </article>
  );
}
