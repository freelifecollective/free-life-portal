import { BadgeMedal, labelFor } from "./BadgeMedal";

/** A badge with just the name of the achievement under it (the group it belongs to shows when you hover). `small` is the same, just smaller. */
export function BadgeTile({ id, small = false }: { id: string; small?: boolean }) {
  const l = labelFor(id);
  if (!l) return null;
  return (
    <div className={"tile" + (small ? " small" : "")} title={`${l.title}: ${l.level}`}>
      <BadgeMedal id={id} size={small ? 52 : 66} />
      <span>{l.level}</span>
    </div>
  );
}
