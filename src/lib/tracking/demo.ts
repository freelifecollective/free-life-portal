import type { Board, Tag, TeamMember } from "./types";

/** Made-up boards and team, only used to draw the faint preview of the tracking pages for people who are not paying yet. */
/* the same tags every affiliate starts with */
export const DEMO_TAGS: Tag[] = [
  { id: "g-ig", name: "Instagram Lead", color: "#7B3FA0", system: true }, { id: "g-fb", name: "Facebook Lead", color: "#2F80ED", system: true }, { id: "g-ad", name: "Ad Lead", color: "#E8890C", system: true },
  { id: "g-no", name: "Said No", color: "#E0559A", system: true }, { id: "g-cant", name: "Can't Find IG", color: "#C2362B", system: true }, { id: "g-dm", name: "DM's Not Seen", color: "#D4A90A", system: true },
  { id: "g-ghost", name: "Ghosted", color: "#6B7280", system: true }, { id: "g-portal", name: "In FLC Portal", color: "#2F7A56", system: true },
];
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
type Seed = [name: string, ig: string | null, tags: string[], added: number, due: number | null];
const list = (id: string, name: string, cards: Seed[] = []) => ({ id, name, kind: null, cards: cards.map(([n, ig, tags, added, due], i) => ({ id: `${id}-${i}`, name: n, email: null, phone: null, note: null, instagram: ig, facebook: null, tags, followUp: due === null ? null : day(due), followDays: 3, createdAt: `${day(added)}T12:00:00Z` })) });
export const DEMO_BOARDS: Board[] = [
  { id: "d1", name: "New Leads", kind: "leads", lists: [
    list("a", "New Lead", [["Jessica Moore", "@jess.moore", ["g-ig"], -1, 2], ["Marcus Hill", "@marcushill", ["g-ad"], -2, 1], ["Dana Whitfield", null, ["g-fb", "g-dm"], -2, 1]]),
    list("b", "Follow Up Set", [["Priya Raman", "@priya.r", ["g-ig", "g-portal"], -5, 2], ["Tom Becker", "@tbecker", ["g-ad"], -4, 3], ["Alicia Gomez", "@aliciag", ["g-fb"], -3, 0]]),
    list("c", "Follow Up Due", [["Sean O'Neil", "@seano", ["g-ig", "g-dm"], -9, -2], ["Leah Park", "@leahpark", ["g-ghost"], -12, -4], ["Chris Dalton", null, ["g-cant"], -8, -1]]),
    list("d", "Portal Invitation Sent", [["Nina Alvarez", "@ninaalvarez", ["g-ig", "g-portal"], -6, 1], ["Ben Foster", "@benfoster", ["g-ad", "g-dm"], -7, 2]]),
    list("e", "Circle Back in 60 Days", [["Tasha Reed", "@tashareed", ["g-no"], -20, null], ["Omar Khalil", "@omark", ["g-fb", "g-no"], -25, null]]),
  ] },
  { id: "d2", name: "Leads in the FLC Portal", kind: "portal", lists: [] },
];
export const DEMO_TEAM: TeamMember[] = [
  { id: "t1", name: "Sample Teammate", email: null, rank: "6A", status: "active", lastCheckIn: null, lastNote: null, started: false, doneLessons: 0, totalLessons: 0, callsMode: null, callsUntil: null, checks: [] },
  { id: "t2", name: "Another Teammate", email: null, rank: "1A", status: "not_in_portal", lastCheckIn: null, lastNote: null, started: false, doneLessons: 0, totalLessons: 0, callsMode: null, callsUntil: null, checks: [] },
];
