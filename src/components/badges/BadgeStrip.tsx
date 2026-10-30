import Link from "next/link";
import { BadgeMedal, labelFor } from "./BadgeMedal";

const SHOWN = 8;

/** A row of small medals, newest first. Nothing at all appears until the first badge is earned. */
export function BadgeStrip({ keys }: { keys: string[] }) {
  if (keys.length === 0) return null;
  const shown = keys.slice(0, SHOWN);
  return (
    <ul className="badge-strip" aria-label="Your badges">
      {shown.map((k) => { const l = labelFor(k); return l ? <li key={k} title={`${l.title}: ${l.level}`}><BadgeMedal id={k} size={46} compact /></li> : null; })}
      {keys.length > SHOWN ? <li><Link className="badge-more" href="/settings" title="See all your badges">+{keys.length - SHOWN}</Link></li> : null}
    </ul>
  );
}
