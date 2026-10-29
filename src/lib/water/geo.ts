export type LatLng = { lat: number; lng: number };

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line distance over the earth's surface, in kilometres (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "12 mi (19 km)", with one decimal under 10 and "Under 1 mi" for very close. */
export function formatDistance(km: number): string {
  const mi = km / 1.609344;
  const n = (v: number) => (v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toLocaleString("en-US");
  if (mi < 1) return `Under 1 mi (${n(km)} km)`;
  return `${n(mi)} mi (${n(km)} km)`;
}

/** The closest `limit` points to `from`, nearest first, each with its distance. */
export function nearest<T extends LatLng>(points: T[], from: LatLng, limit = 8): (T & { km: number })[] {
  return points.map((p) => ({ ...p, km: distanceKm(from, p) })).sort((a, b) => a.km - b.km).slice(0, limit);
}
