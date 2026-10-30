/** The shared goal for registrations to the next call, across every member's page. */
export const REGISTRATION_GOAL = 500;

export type PublicLanding = {
  member_id: string;
  username: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  instagram: string | null;
  facebook: string | null;
  theme: "light" | "dark";
};

export type PublicCall = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  length_label?: string | null;
  registered: number;
  speakers?: { name: string; photo_url: string | null }[];
};

export const instagramUrl = (h: string) => `https://www.instagram.com/${encodeURIComponent(h)}/`;
export const facebookUrl = (h: string) => `https://www.facebook.com/${encodeURIComponent(h)}`;
