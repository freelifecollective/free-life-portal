/** The pages a documents folder can be set to show on (below the subtitle). */
export const PLACEMENTS: [string, string][] = [
  ["verbiage", "Verbiage + Objections"], ["financing", "Financing Options"], ["calculator", "Earnings Estimator"], ["quote", "Create a Quote"],
  ["buddy", "Accountability Buddy"], ["facebook", "Facebook Follows"], ["organization", "Your Organization"],
  ["outsourcing", "Outsourcing"], ["closers", "Call Closers for Hire"], ["graphics", "Graphic maker"],
  ["tasks", "Tasks"], ["weekly", "Weekly Focus"], ["courses", "Courses"], ["launch", "Business Launch Course"],
  ["books", "Books"], ["products", "Product Information"], ["media", "Pictures/Videos"], ["canva", "Canva Templates"], ["evidence", "Evidence Manual"], ["landing", "Landing Page"], ["tracking", "Lead Tracking"], ["numbers", "Know Your Numbers"], ["team", "My Team"],
];
export const placementLabel = (k: string | null | undefined) => PLACEMENTS.find(([v]) => v === k)?.[1] ?? null;
