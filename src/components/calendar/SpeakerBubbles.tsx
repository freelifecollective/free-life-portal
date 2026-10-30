import { Avatar } from "@/components/Avatar";
import type { Speaker } from "@/lib/calls/types";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

/** "Sonya & Lacey" / "Sonya, Lacey & Maya" */
export function speakerNames(list: Speaker[]): string {
  const names = list.map((s) => s.name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** Round pictures of the people speaking on a call, slightly overlapping, with their names beside them. */
export function SpeakerBubbles({ speakers, size = 52, label = "Speaking" }: { speakers: Speaker[]; size?: number; label?: string | null }) {
  if (speakers.length === 0) return null;
  return (
    <div className="speakers">
      <ul className="speaker-bubbles" aria-label={label ?? "Speakers"}>
        {speakers.map((s, i) => (
          <li key={s.name + i} title={s.name}><Avatar url={s.photo_url} initials={initials(s.name)} size={size} label={s.name} /></li>
        ))}
      </ul>
      <span className="speaker-names">{label ? <small>{label}</small> : null}<strong>{speakerNames(speakers)}</strong></span>
    </div>
  );
}
