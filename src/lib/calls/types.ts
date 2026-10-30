export const CALL_KINDS = ["community", "masterclass", "other"] as const;
export type CallKind = (typeof CALL_KINDS)[number];
export const AUDIENCES = ["leads_open", "affiliates_only"] as const;
export type Audience = (typeof AUDIENCES)[number];
export type RsvpMode = "live" | "recording";

export type Call = {
  id: string;
  title: string;
  description: string | null;
  kind: CallKind;
  audience: Audience;
  starts_at: string;
  duration_minutes: number;
  pinned: boolean;
  join_url: string | null;
  host: string | null;
  length_label?: string | null;
  /** who is speaking (as the database returns it; use speakersOf() for the sorted list) */
  call_speakers?: { name: string; photo_url: string | null; position: number }[];
};

export type Speaker = { name: string; photo_url: string | null };

/** The speakers of a call, in the order the admin set. */
export function speakersOf(call: Pick<Call, "call_speakers">): Speaker[] {
  return [...(call.call_speakers ?? [])].sort((a, b) => a.position - b.position).map(({ name, photo_url }) => ({ name, photo_url }));
}

export type Person = { name: string; username: string | null; avatar_url: string | null; mode: RsvpMode };
export type RsvpSummary = { live: number; recording: number; mine: RsvpMode | null; people: Person[] };

export const KIND_LABEL: Record<CallKind, string> = { community: "Community call", masterclass: "Mastermind Call", other: "Call" };
/** The kinds an admin can pick for a new call ("Call" only survives on older calls). */
export const SELECTABLE_KINDS: CallKind[] = ["community", "masterclass"];
/** The heading on the next-call card, by what kind of call it is. */
export const NEXT_LABEL: Record<CallKind, string> = { community: "Next Community Call", masterclass: "Next Mastermind Call", other: "Next Call" };
export const AUDIENCE_LABEL: Record<Audience, string> = { leads_open: "Open to leads", affiliates_only: "Affiliates only" };

/** Mastermind calls are for affiliates; community calls are open. The admin can still change it per call. */
export function defaultAudience(kind: CallKind): Audience {
  return kind === "masterclass" ? "affiliates_only" : "leads_open";
}

export const CALL_COLUMNS = "id, title, description, kind, audience, starts_at, duration_minutes, pinned, join_url, host, length_label, call_speakers(name, photo_url, position)";
