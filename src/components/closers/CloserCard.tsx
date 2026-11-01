import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ProfileButton } from "@/components/people/ProfilePopup";
import { closerName, dollars, type CloserCardData } from "@/lib/closers/types";

/** One call closer: picture, name, stars, how many members booked them, and their price. */
export function CloserCard({ c, me }: { c: CloserCardData; me: string }) {
  const name = closerName(c);
  const stars = c.avg_rating ? "★".repeat(Math.round(c.avg_rating)) + "☆".repeat(5 - Math.round(c.avg_rating)) : null;
  return (
    <article className="card-s closer-card">
      <div className="who"><Avatar url={c.avatar_url} initials={name.charAt(0).toUpperCase()} size={56} />
        <span className="who-name"><strong>{name}</strong>
          <span className="when">{stars ? <><span aria-hidden="true">{stars}</span> {`${c.avg_rating} · ${c.review_count} ${c.review_count === 1 ? "review" : "reviews"}`}</> : "No reviews yet"}</span></span></div>
      <ul className="closer-facts">
        {c.members_booked > 0 ? <li><span>FLC members booked</span><b>{c.members_booked}</b></li> : null}
        {c.calls_taken ? <li><span>Calls taken</span><b>{c.calls_taken}</b></li> : null}
        {c.price_per_call_cents !== null ? <li><span>Price per call (USD)</span><b>{dollars(c.price_per_call_cents)}</b></li> : null}
        {c.price_per_sale ? <li><span>Charge per product sale (USD)</span><b className="closer-sale">{c.price_per_sale}</b></li> : null}
      </ul>
      <div className="rs-actions">
        <ProfileButton id={c.id} view="closer" className="btn small primary">See profile and reviews</ProfileButton>
        {c.username && c.id !== me ? <Link className="btn small" href={`/messages/${c.username}`} style={{ textDecoration: "none" }}>Message</Link> : null}
      </div>
    </article>
  );
}
