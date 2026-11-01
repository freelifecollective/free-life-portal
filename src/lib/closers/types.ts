export type CloserCardData = {
  id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null;
  calls_taken: string | null; closer_since: string | null; close_rate: number | null; price_per_call_cents: number | null; price_per_sale: string | null;
  review_count: number; avg_rating: number | null; members_booked: number;
  cover_url: string | null; location: string | null; experience_text: string | null; bio: string | null;
  paused?: boolean; on_waitlist?: boolean;
};

export type Application = {
  id: string; member_id: string; status: "pending" | "approved" | "declined"; experience: "none" | "some" | "lots" | null; calls_taken: string | null;
  cover_url: string | null; location: string | null; experience_text: string | null; bio: string | null;
  availability: string; pitch: string; price_per_call_cents: number | null; price_per_sale: string | null; review_note: string | null; created_at: string;
};

export const EXPERIENCE = [
  { id: "none", label: "I'm new to sales calls" },
  { id: "some", label: "I've taken some calls" },
  { id: "lots", label: "I take calls regularly" },
] as const;

export const closerName = (c: Pick<CloserCardData, "first_name" | "last_name">) => [c.first_name, c.last_name].filter(Boolean).join(" ") || "Member";
export const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
