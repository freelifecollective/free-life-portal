import type { Place } from "./types";

export type Suggestion = { title: string; detail: string; place: Place };

type Feature = { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> };

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

/** Turns Photon's (OpenStreetMap) search answer into short dropdown choices. The saved label stays town-level, never the street. */
export function parsePhoton(json: unknown, limit = 6): Suggestion[] {
  const features = ((json as { features?: Feature[] } | null)?.features ?? []);
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const town = p.city ?? p.town ?? p.village ?? p.district ?? p.locality ?? p.county;
    const title = p.name ?? (street || town);
    if (!title) continue;
    const detail = uniq([p.name ? street : undefined, p.name === town ? undefined : town, p.state, p.country]).join(", ");
    const key = `${title}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = uniq([town, p.state, p.country]).join(", ") || title;
    out.push({ title, detail, place: { lat, lng, label } });
    if (out.length >= limit) break;
  }
  return out;
}
