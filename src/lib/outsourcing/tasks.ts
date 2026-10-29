/** What people can offer, in alphabetical order. The database enforces the same list (migration 0016). */
/** The choices for "for how long?" (kept in step with the check in migration 0028). */
export const VA_LENGTHS = ["Less than 6 months", "6 months to 1 year", "1 to 2 years", "2 to 5 years", "More than 5 years"] as const;

export const OFFERINGS = [
  "Ads Creation",
  "Ads Manager",
  "Canva Presentations",
  "Coaching Calls",
  "Content Creation",
  "Creating Forms",
  "Emails + Campaigns",
  "General Organization",
  "Google Suite",
  "Lead Follow-Up",
  "Lead Organization",
  "Zoom support",
] as const;
