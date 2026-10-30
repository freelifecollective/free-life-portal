import { BadgeMedal, labelFor } from "./BadgeMedal";

/** A badge with its name under it: the medal, what it was for, and which badge group it belongs to. `small` is the same, just smaller. */
export function BadgeTile({ id, small = false }: { id: string; small?: boolean }) {
  const l = labelFor(id);
  if (!l) return null;
  return (
    <div className={"tile" + (small ? " small" : "")} title={`${l.title}: ${l.level}`}>
      <BadgeMedal id={id} size={small ? 52 : 66} />
      <span>{l.level}</span>
      <small>{l.title}</small>
    </div>
  );
}
