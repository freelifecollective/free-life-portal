const EUROPE = [
  "Albania", "Andorra", "Austria", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Czech Republic", "Denmark", "Estonia",
  "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
  "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "San Marino", "Serbia",
  "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "United Kingdom", "Ukraine", "Vatican City",
];
const OTHER: Record<string, string> = {
  "united states": "United States", "united states of america": "United States", usa: "United States", canada: "Canada",
  mexico: "Mexico", "méxico": "Mexico", australia: "Australia", "new zealand": "New Zealand",
};

/** The country on the end of a saved water map place ("Bowmanville, Ontario, Canada"), as the Earnings Estimator names it. */
export function countryFromPlace(place: string | null | undefined): string | null {
  const last = (place ?? "").split(",").pop()?.trim() ?? "";
  if (!last) return null;
  if (OTHER[last.toLowerCase()]) return OTHER[last.toLowerCase()];
  return EUROPE.some((c) => c.toLowerCase() === last.toLowerCase()) ? "Europe" : null;
}

/**
 * Which country the Earnings Estimator starts on: the country they put themselves on the Water Share Map in,
 * otherwise Europe for Spanish, French, Italian and German readers, otherwise the United States.
 * They can always change it on the page.
 */
export function defaultCalcCountry(place: string | null | undefined, lang: string | null | undefined, fallback = "United States"): string {
  return countryFromPlace(place) ?? (lang === "es" || lang === "fr" || lang === "it" || lang === "de" ? "Europe" : fallback);
}
