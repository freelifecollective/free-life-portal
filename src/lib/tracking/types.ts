export type Tag = { id: string; name: string; color: string; system: boolean };
export type Card = {
  id: string; name: string; email: string | null; phone: string | null; note: string | null;
  instagram: string | null; facebook: string | null; tags: string[]; followUp: string | null; followDays: number; createdAt?: string; portalUser?: string | null;
};
export type ListT = { id: string; name: string; kind: string | null; cards: Card[] };
export type Board = { id: string; name: string; kind: string | null; lists: ListT[] };

export type TeamCheck = { id: string; label: string; kind: "manual" | "graphic" | "welcome_chat" | "team_chat" | "course_started" | "course_half" | "course_done"; done: boolean };
export type TeamStatus = "active" | "registered" | "invited" | "not_in_portal" | "left" | "inactive";
export type TeamMember = {
  id: string; name: string; email: string | null; rank: string; status: TeamStatus;
  lastCheckIn: string | null; lastNote: string | null; checks: TeamCheck[];
  started: boolean; doneLessons: number; totalLessons: number;
  callsMode: "for" | "together" | null; callsUntil: string | null;
};
/** Ranks a team member can be at, lowest first. */
export const TEAM_RANKS = ["1A", "2A", "3A", "4A", "5A", "6A", "6A2", "6A2-2", "6A2-3", "6A2-4", "6A2-5", "6A2-6", "6A2-7", "6A2-8"] as const;
