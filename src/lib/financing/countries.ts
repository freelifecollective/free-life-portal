export const COUNTRIES = [
  { slug: "usa", name: "USA" },
  { slug: "canada", name: "Canada" },
  { slug: "australia", name: "Australia" },
  { slug: "new-zealand", name: "New Zealand" },
  { slug: "germany", name: "Germany" },
  { slug: "united-kingdom", name: "The United Kingdom", value: "United Kingdom" },
] as const;

/** What is stored in the database for a country. */
export const countryValue = (c: (typeof COUNTRIES)[number]): string => ("value" in c ? c.value : c.name);
export const countryBySlug = (slug: string | undefined) => COUNTRIES.find((c) => c.slug === slug) ?? COUNTRIES[0];
