import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { HireButton } from "./HireButton";
import { ProfileButton } from "@/components/people/ProfilePopup";
import { closerName, dollars, type CloserCardData } from "@/lib/closers/types";

/** One call closer, laid out like their profile popup: picture and name on top, their numbers in a white card, then two buttons. */
export function CloserCard({ c, me }: { c: CloserCardData; me: string }) {
  const name = closerName(c);
  const stars = c.avg_rating ? "★".repeat(Math.round(c.avg_rating)) + "☆".repeat(5 - Math.round(c.avg_rating)) : null;
  const rows: { label: string; value: string; pre?: boolean }[] = [];
  rows.push({ label: "Reviews", value: c.avg_rating ? `${c.avg_rating} · ${c.review_count} ${c.review_count === 1 ? "review" : "reviews"}` : "No reviews yet" });
  if (c.members_booked > 0) rows.push({ label: "FLC members booked", value: String(c.members_booked) });
  if (c.calls_taken) rows.push({ label: "Calls taken", value: c.calls_taken });
  if (c.price_per_call_cents !== null) rows.push({ label: "Price per call (USD)", value: dollars(c.price_per_call_cents) });
  if (c.price_per_sale) rows.push({ label: "Charge per product sale (USD)", value: c.price_per_sale, pre: true });
  const canMessage = !!c.username && c.id !== me;
  return (
    <article className="cc">
      <div className="pc-top">
        <Avatar url={c.avatar_url} initials={name.charAt(0).toUpperCase()} size={96} />
        <h2 className="pc-name">{name}</h2>
        <p className="pc-sub">Call closer</p>
        {stars ? <p className="pc-sub cc-stars" aria-label={`${c.avg_rating} out of 5`}>{stars}</p> : null}
      </div>
      <div className="pc-card">
        {rows.map((r) => (
          <div className="pc-row pc-plain" key={r.label}><div><small>{r.label}</small><span style={r.pre ? { whiteSpace: "pre-line" } : undefined}>{r.value}</span></div></div>
        ))}
      </div>
      {c.id !== me ? <HireButton closerId={c.id} first={c.first_name ?? "them"} /> : null}
      <div className="cc-tiles" style={{ gridTemplateColumns: canMessage ? "1fr 1fr" : "1fr" }}>
        <ProfileButton id={c.id} view="closer" className="pc-tile cc-tile">See profile and reviews</ProfileButton>
        {canMessage ? <Link className="pc-tile cc-tile" href={`/messages/${c.username}`} style={{ textDecoration: "none" }}>Message</Link> : null}
      </div>
    </article>
  );
}
