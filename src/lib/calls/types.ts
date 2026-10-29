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
};

export type Person = { name: string; username: string | null; avatar_url: string | null; mode: RsvpMode };
export type RsvpSummary = { live: number; recording: number; mine: RsvpMode | null; people: Person[] };

export const KIND_LABEL: Record<CallKind, string> = { community: "Community call", masterclass: "Masterclass", other: "Call" };
export const AUDIENCE_LABEL: Record<Audience, string> = { leads_open: "Open to leads", affiliates_only: "Affiliates only" };

/** Masterclasses are for affiliates; community calls are open. The admin can still change it per call. */
export function defaultAudience(kind: CallKind): Audience {
  return kind === "masterclass" ? "affiliates_only" : "leads_open";
}

export const CALL_COLUMNS = "id, title, description, kind, audience, starts_at, duration_minutes, pinned, join_url, host";
