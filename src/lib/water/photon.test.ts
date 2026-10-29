import { describe, expect, it } from "vitest";
import { parsePhoton } from "./photon";

const sample = { features: [
  { geometry: { coordinates: [-78.68, 43.91] }, properties: { name: "Walmart Supercentre", housenumber: "2380", street: "Durham Regional Road 57", city: "Bowmanville", state: "Ontario", country: "Canada" } },
  { geometry: { coordinates: [-78.68, 43.91] }, properties: { name: "Walmart Supercentre", housenumber: "2380", street: "Durham Regional Road 57", city: "Bowmanville", state: "Ontario", country: "Canada" } },
  { geometry: { coordinates: [-78.7, 43.9] }, properties: { street: "King Street", city: "Bowmanville", state: "Ontario", country: "Canada" } },
  { geometry: {}, properties: { name: "No coordinates" } },
] };

describe("parsePhoton", () => {
  const r = parsePhoton(sample);
  it("builds a title and full address line, and drops duplicates and results without a position", () => {
    expect(r).toHaveLength(2);
    expect(r[0].title).toBe("Walmart Supercentre");
    expect(r[0].detail).toBe("2380 Durham Regional Road 57, Bowmanville, Ontario, Canada");
    expect(r[0].place).toEqual({ lat: 43.91, lng: -78.68, label: "Bowmanville, Ontario, Canada" });
  });
  it("uses the street as the title when there is no name, and saves only the town", () => {
    expect(r[1].title).toBe("King Street");
    expect(r[1].place.label).toBe("Bowmanville, Ontario, Canada");
  });
  it("copes with junk", () => {
    expect(parsePhoton(null)).toEqual([]);
    expect(parsePhoton({})).toEqual([]);
  });
});
