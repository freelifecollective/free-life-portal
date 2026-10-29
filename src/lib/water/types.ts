export type WaterPin = {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string | null;
  place: string;
  lat: number;
  lng: number;
  prefilter: boolean;
  water_type: "city" | "well";
};

export type Place = { lat: number; lng: number; label: string };

export const WATER_LABEL = { city: "City water", well: "Well water" } as const;

export function pinName(p: Pick<WaterPin, "first_name" | "last_name">): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Member";
}
