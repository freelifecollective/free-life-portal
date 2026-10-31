import { countryCodeFromPlace } from "@/lib/countries";

const EUROPE = new Set("AL AD AT BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO SM RS SK SI ES SE CH GB UA VA".split(" "));
const OTHER: Record<string, string> = { US: "United States", CA: "Canada", MX: "Mexico", AU: "Australia", NZ: "New Zealand" };

/** The Earnings Estimator's name for a country code ("ES" becomes "Europe"), or null when the estimator has nothing for it. */
export function calcCountryOf(code: string | null | undefined): string | null {
  if (!code) return null;
  return OTHER[code] ?? (EUROPE.has(code) ? "Europe" : null);
}

/** Kept for the old way of reading a Water Share Map place. */
export function countryFromPlace(place: string | null | undefined): string | null {
  return calcCountryOf(countryCodeFromPlace(place));
}

/**
 * Which country the Earnings Estimator starts on: where the member said they live (or put themselves on the Water Share Map),
 * otherwise Europe for Spanish, French, Italian and German readers, otherwise the United States.
 * They can always change it on the page.
 */
export function defaultCalcCountry(placeOrCode: string | null | undefined, lang: string | null | undefined, fallback = "United States", code?: string | null): string {
  return calcCountryOf(code) ?? countryFromPlace(placeOrCode) ?? (lang === "es" || lang === "fr" || lang === "it" || lang === "de" ? "Europe" : fallback);
}
