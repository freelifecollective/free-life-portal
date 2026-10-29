import { describe, expect, it } from "vitest";
import { distanceKm, formatDistance, nearest } from "./geo";

describe("distance", () => {
  it("knows London to Paris is about 344 km", () => {
    const d = distanceKm({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 });
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(348);
  });
  it("is zero for the same point and works across the date line", () => {
    expect(distanceKm({ lat: 10, lng: 10 }, { lat: 10, lng: 10 })).toBe(0);
    expect(distanceKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 })).toBeLessThan(115);
  });
  it("formats miles first and kilometres in brackets", () => {
    expect(formatDistance(160.9344)).toBe("100 mi (161 km)");
    expect(formatDistance(8.04672)).toBe("5 mi (8 km)");
    expect(formatDistance(0.5)).toBe("Under 1 mi (0.5 km)");
  });
  it("lists the closest first", () => {
    const pts = [{ id: "far", lat: 40, lng: 0 }, { id: "near", lat: 1, lng: 0 }, { id: "mid", lat: 10, lng: 0 }];
    expect(nearest(pts, { lat: 0, lng: 0 }, 2).map((p) => p.id)).toEqual(["near", "mid"]);
  });
});
