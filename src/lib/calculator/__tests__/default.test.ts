import { describe, expect, it } from "vitest";
import { countryFromPlace, defaultCalcCountry } from "../default";

describe("estimator starting country", () => {
  it("reads the country off the end of a water map place", () => {
    expect(countryFromPlace("Bowmanville, Ontario, Canada")).toBe("Canada");
    expect(countryFromPlace("Madrid, Community of Madrid, Spain")).toBe("Europe");
    expect(countryFromPlace("Guadalajara, Jalisco, Mexico")).toBe("Mexico");
    expect(countryFromPlace("Austin, Texas, United States")).toBe("United States");
    expect(countryFromPlace("Somewhere, Brazil")).toBeNull();
    expect(countryFromPlace(null)).toBeNull();
  });
  it("uses the water map first, then the language, then the US", () => {
    expect(defaultCalcCountry("Guadalajara, Jalisco, Mexico", "it")).toBe("Mexico");
    expect(defaultCalcCountry(null, "es")).toBe("Europe");
    expect(defaultCalcCountry(null, "de")).toBe("Europe");
    expect(defaultCalcCountry(null, "en")).toBe("United States");
    expect(defaultCalcCountry("Somewhere, Brazil", "fr")).toBe("Europe");
  });
});
