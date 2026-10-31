import { describe, expect, it } from "vitest";
import { adviseLanguages, countryCodeFromPlace, countryName, isCountryCode, languageOf } from "../countries";
import { calcCountryOf, defaultCalcCountry } from "../calculator/default";

describe("countries", () => {
  it("knows codes and names", () => {
    expect(isCountryCode("ES")).toBe(true);
    expect(isCountryCode("Spain")).toBe(false);
    expect(countryName("ES", "en")).toBe("Spain");
    expect(countryName("ES", "it")).toBe("Spagna");
    expect(languageOf("BR")).toBe("pt");
  });
  it("reads the country off a water map place", () => {
    expect(countryCodeFromPlace("Bowmanville, Ontario, Canada")).toBe("CA");
    expect(countryCodeFromPlace("Rome, Lazio, Italy")).toBe("IT");
    expect(countryCodeFromPlace("London, England, United Kingdom")).toBe("GB");
    expect(countryCodeFromPlace("Austin, Texas, United States")).toBe("US");
    expect(countryCodeFromPlace("Nowhere")).toBeNull();
  });
  it("starts the estimator on the chosen country", () => {
    expect(calcCountryOf("DE")).toBe("Europe");
    expect(calcCountryOf("MX")).toBe("Mexico");
    expect(calcCountryOf("BR")).toBeNull();
    expect(defaultCalcCountry(null, "en", "United States", "AU")).toBe("Australia");
    expect(defaultCalcCountry(null, "it", "United States", "MX")).toBe("Mexico");
    expect(defaultCalcCountry(null, "it", "United States", null)).toBe("Europe");
    expect(defaultCalcCountry(null, "en", "United States", "BR")).toBe("United States");
  });
  it("recommends languages we do not have yet", () => {
    const a = adviseLanguages([
      { country: "BR", members: 6, leads: 0 }, { country: "PT", members: 1, leads: 0 }, { country: "NL", members: 2, leads: 0 },
      { country: "US", members: 20, leads: 0 }, { country: "ES", members: 9, leads: 0 }, { country: null, members: 3, leads: 0 },
    ]);
    expect(a.map((x) => x.lang)).toEqual(["pt", "nl"]);
    expect(a[0]).toMatchObject({ name: "Portuguese", members: 7, recommended: true });
    expect(a[1].recommended).toBe(false);
    expect(adviseLanguages([{ country: "GB", members: 4, leads: 0 }])).toEqual([]);
  });
});
