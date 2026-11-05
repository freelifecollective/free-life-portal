import type { Board, TeamMember } from "./types";

/** Made-up boards and team, only used to draw the faint preview of the tracking pages for people who are not paying yet. */
const list = (id: string, name: string, cards: string[] = []) => ({ id, name, kind: null, cards: cards.map((c, i) => ({ id: `${id}-${i}`, name: c, email: null, phone: null, note: null, instagram: null, facebook: null, tags: [], followUp: null, followDays: 3 })) });
export const DEMO_BOARDS: Board[] = [
  { id: "d1", name: "New Leads", kind: "leads", lists: [list("a", "New Lead", ["Sample Lead", "Another Lead"]), list("b", "Follow Up Set", ["Sample Lead"]), list("c", "Follow Up Due", ["Sample Lead"]), list("d", "Portal Invitation Sent"), list("e", "Circle Back in 60 Days")] },
  { id: "d2", name: "Leads in the FLC Portal", kind: "portal", lists: [] },
];
export const DEMO_TEAM: TeamMember[] = [
  { id: "t1", name: "Sample Teammate", email: null, rank: "6A", status: "active", lastCheckIn: null, lastNote: null, started: false, doneLessons: 0, totalLessons: 0, callsMode: null, callsUntil: null, checks: [] },
  { id: "t2", name: "Another Teammate", email: null, rank: "1A", status: "not_in_portal", lastCheckIn: null, lastNote: null, started: false, doneLessons: 0, totalLessons: 0, callsMode: null, callsUntil: null, checks: [] },
];
