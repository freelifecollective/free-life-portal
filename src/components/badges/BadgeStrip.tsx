import Link from "next/link";
import { BadgeTile } from "./BadgeTile";

const SHOWN = 6;

/** A row of badges, newest first, the same as on the profile but a little smaller. Nothing at all appears until the first badge is earned. */
export function BadgeStrip({ keys }: { keys: string[] }) {
  if (keys.length === 0) return null;
  return (
    <ul className="badge-strip" aria-label="Your badges">
      {keys.slice(0, SHOWN).map((k) => <li key={k}><BadgeTile id={k} small /></li>)}
      {keys.length > SHOWN ? <li><Link className="badge-more" href="/settings" title="See all your badges">+{keys.length - SHOWN}</Link></li> : null}
    </ul>
  );
}
