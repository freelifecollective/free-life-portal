"use client";

import { PersonLink } from "@/components/people/ProfilePopup";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteReview, saveReview, setHired } from "@/app/(app)/outsourcing/actions";
import { Avatar } from "@/components/Avatar";
import type { MyHire, Provider, Review } from "@/lib/outsourcing/queries";
import { formatInZone } from "@/lib/time";

const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const fullName = (p: Provider) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";

function Card({ p, hire, reviews, me, isAdmin }: { p: Provider; hire?: MyHire; reviews: Review[]; me: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [rating, setRating] = useState(hire?.rating ?? 0);
  const [text, setText] = useState(hire?.review ?? "");
  const mine = p.member_id === me;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setError(""); const r = await fn(); if (!r.ok) setError(r.error ?? "That did not work."); });
  const shown = allReviews ? reviews : reviews.slice(0, 3);

  return (
    <article className="card-s provider">
      <div className="provider-head">
        <PersonLink id={p.member_id} name={fullName(p)} className="who"><Avatar url={p.avatar_url} initials={fullName(p).charAt(0).toUpperCase()} size={48} />
          <span className="who-name"><strong>{fullName(p)}</strong>{p.is_admin ? <small className="admin-tag">Admin</small> : null}</span></PersonLink>
        <button type="button" className="provider-toggle when" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide details" : "Tap for rate and details"}</button>
      </div>
      <p className="offer-label">Offering</p>
      <ul className="tags">{p.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
      {p.va_experience ? <p className="when" style={{ margin: "10px 0 0" }}>VA experience: <strong>{p.va_experience_length}</strong></p> : null}
      {p.about ? <p className="post-body" style={{ marginTop: 10 }}>{p.about}</p> : null}
      <p className="when" style={{ margin: "8px 0 0" }}>
        {p.hires} {p.hires === 1 ? "person has" : "people have"} hired {mine ? "you" : "them"}
        {p.reviews ? <> · <span className="stars" aria-label={`${p.avg_rating} out of 5`}>{stars(p.avg_rating ?? 0)}</span> {p.avg_rating} ({p.reviews} {p.reviews === 1 ? "review" : "reviews"})</> : " · No reviews yet"}
      </p>
      {shown.length ? (
        <ul className="comments">
          {shown.map((r) => (
            <li key={r.id}><strong>{r.reviewer}</strong> <span className="stars">{stars(r.rating)}</span> <time className="when" dateTime={r.at}>{formatInZone(new Date(r.at))}</time>
              {r.review ? <p>{r.review}</p> : null}
              {isAdmin ? <button type="button" className="linkbtn danger" onClick={() => { if (window.confirm("Remove this review?")) run(() => deleteReview(r.id)); }}>Remove review</button> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {reviews.length > 3 ? <p style={{ margin: "8px 0 0" }}><button className="linkbtn" type="button" style={{ padding: 0 }} onClick={() => setAllReviews(!allReviews)}>{allReviews ? "Show fewer reviews" : `Show all ${reviews.length} reviews`}</button></p> : null}

      {open ? (
        <div className="provider-more">
          <p className="rate-line">Hourly rate: <strong>${(p.hourly_rate_cents / 100).toFixed(2)}</strong> per hour</p>
          {!mine ? (
            <div className="rs-actions" style={{ marginTop: 0 }}>
              <Link className="btn small primary" href={`/messages/${p.username}`} style={{ textDecoration: "none" }}>Message</Link>
              <button className="btn small" type="button" disabled={pending} onClick={() => run(() => setHired(p.member_id, !hire))}>{hire ? "✓ I hired them (undo)" : "I hired them"}</button>
            </div>
          ) : null}
          {hire ? (
            <div className="review-box">
              <p style={{ margin: "0 0 6px", fontWeight: 600 }}>{hire.rating ? "Your review" : "Leave a review"}</p>
              <div role="radiogroup" aria-label="Rating" className="star-pick">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>)}
              </div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder="How was it working with them? (optional)" aria-label="Your review" />
              <button className="btn small" type="button" disabled={pending || rating < 1} onClick={() => run(() => saveReview(hire.id, rating, text))}>Save review</button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
    </article>
  );
}

export function ProviderList({ providers, hired, reviews, me, isAdmin }: { providers: Provider[]; hired: MyHire[]; reviews: Review[]; me: string; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = needle ? providers.filter((p) => [fullName(p), p.about ?? "", ...p.tasks].join(" ").toLowerCase().includes(needle)) : providers;
  return (
    <section aria-label="People offering help">
      <div className="field" style={{ marginBottom: 14 }}><label htmlFor="o-q">Find help</label><input id="o-q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by what they offer or by name, like “ads” or “Zoom”" /></div>
      {list.length === 0 ? <section className="card-s"><p style={{ margin: 0 }}>{providers.length ? "No one matches that search." : "No one has listed their services yet. Be the first!"}</p></section> : (
        <div className="settings">{list.map((p) => <Card key={p.member_id} p={p} hire={hired.find((h) => h.provider_id === p.member_id)} reviews={reviews.filter((r) => r.provider_id === p.member_id)} me={me} isAdmin={isAdmin} />)}</div>
      )}
    </section>
  );
}
