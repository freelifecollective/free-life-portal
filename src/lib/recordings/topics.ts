/** The topics a recording can be sorted under, A to Z. The database accepts only these (migration 0022). */
export const TOPICS = [
  "6A+ Interviews",
  "Ads",
  "Belief + Mindset",
  "Community calls",
  "Compensation Plan",
  "Event Launches + Recaps",
  "Know Your Numbers",
  "Special Guests",
  "Strategy",
  "Success Doesn't Discriminate",
  "Talking to Leads + Objections",
] as const;
export type Topic = (typeof TOPICS)[number];
/** Recordings under this topic are open to leads automatically. */
export const LEAD_TOPIC: Topic = "Community calls";
export const isTopic = (t: string): t is Topic => (TOPICS as readonly string[]).includes(t);
