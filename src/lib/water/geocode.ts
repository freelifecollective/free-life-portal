import "server-only";
import { parsePhoton, type Suggestion } from "./photon";
import type { Place } from "./types";

type Hit = { lat: string; lon: string; display_name: string; address?: Record<string, string> };

/** A short label for a result: town, region, country. Never the street, so the saved text cannot reveal an exact address. */
function labelOf(h: Hit): string {
  const a = h.address ?? {};
  const town = a.city ?? a.town ?? a.village ?? a.suburb ?? a.hamlet ?? a.municipality ?? a.county;
  const parts = [town, a.state ?? a.region, a.country].filter((x): x is string => !!x);
  const out = [...new Set(parts)].join(", ");
  return out || h.display_name.split(",").slice(-2).join(",").trim();
}

/** Looks a place or address up on OpenStreetMap's free search (Nominatim). Returns null when nothing matches or the service is down. */
export async function geocode(query: string): Promise<Place | null> {
  const q = query.trim();
  if (q.length < 2 || q.length > 200) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "FreeLifeCollectivePortal/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const hits = (await res.json()) as Hit[];
    const h = hits[0];
    if (!h) return null;
    const lat = Number(h.lat), lng = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: labelOf(h) };
  } catch {
    return null;
  }
}

/** Dropdown choices while someone types a store or address (Photon, a free search built on OpenStreetMap for exactly this). */
export async function suggest(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 3 || q.length > 120) return [];
  try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=8&lang=en&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "FreeLifeCollectivePortal/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return parsePhoton(await res.json());
  } catch {
    return [];
  }
}
