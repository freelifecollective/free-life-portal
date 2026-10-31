/**
 * Every country: its two-letter code and the main language people there use.
 * Names are not written out here: the browser can name any country in any language (Intl.DisplayNames).
 */
const RAW = `
AF:fa AL:sq DZ:ar AD:ca AO:pt AG:en AR:es AM:hy AU:en AT:de AZ:az BS:en BH:ar BD:bn BB:en BY:ru BE:fr BZ:en BJ:fr BT:dz BO:es BA:bs BW:en BR:pt BN:ms BG:bg BF:fr BI:fr
KH:km CM:fr CA:en CV:pt CF:fr TD:fr CL:es CN:zh CO:es KM:ar CG:fr CD:fr CR:es CI:fr HR:hr CU:es CY:el CZ:cs DK:da DJ:fr DM:en DO:es EC:es EG:ar SV:es GQ:es ER:ti EE:et SZ:en ET:am
FJ:en FI:fi FR:fr GA:fr GM:en GE:ka DE:de GH:en GR:el GD:en GT:es GN:fr GW:pt GY:en HT:fr HN:es HU:hu IS:is IN:hi ID:id IR:fa IQ:ar IE:en IL:he IT:it JM:en JP:ja JO:ar KZ:kk KE:en
KI:en KW:ar KG:ky LA:lo LV:lv LB:ar LS:en LR:en LY:ar LI:de LT:lt LU:fr MG:mg MW:en MY:ms MV:dv ML:fr MT:en MH:en MR:ar MU:en MX:es FM:en MD:ro MC:fr MN:mn ME:sr MA:ar MZ:pt MM:my
NA:en NR:en NP:ne NL:nl NZ:en NI:es NE:fr NG:en KP:ko MK:mk NO:no OM:ar PK:ur PW:en PA:es PG:en PY:es PE:es PH:tl PL:pl PT:pt QA:ar RO:ro RU:ru RW:rw KN:en LC:en VC:en WS:sm
SM:it ST:pt SA:ar SN:fr RS:sr SC:en SL:en SG:en SK:sk SI:sl SB:en SO:so ZA:en KR:ko SS:en ES:es LK:si SD:ar SR:nl SE:sv CH:de SY:ar TW:zh TJ:tg TZ:sw TH:th TL:pt TG:fr TO:to
TT:en TN:ar TR:tr TM:tk TV:en UG:en UA:uk AE:ar GB:en US:en UY:es UZ:uz VU:en VA:it VE:es VN:vi YE:ar ZM:en ZW:en XK:sq PR:es
`;

export type Country = { code: string; lang: string };
export const COUNTRIES: Country[] = RAW.trim().split(/\s+/).map((x) => { const [code, lang] = x.split(":"); return { code, lang }; });
const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export const isCountryCode = (c: unknown): c is string => typeof c === "string" && BY_CODE.has(c);

/** The languages the portal can be switched to. Everything else is a language we could add. */
export const SUPPORTED_LANGS = ["en", "es", "fr", "it", "de"];

export function languageOf(code: string): string { return BY_CODE.get(code)?.lang ?? "en"; }

/** A country's name in the reader's language ("Spain", "España", "Spanien"). */
export function countryName(code: string, lang = "en"): string {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code; } catch { return code; }
}

/** A language's name in English ("Portuguese"). */
export function languageName(lang: string): string {
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang; } catch { return lang; }
}

const ALIASES: Record<string, string> = {
  usa: "US", "united states of america": "US", uk: "GB", "great britain": "GB", england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB",
  turkey: "TR", "türkiye": "TR", czechia: "CZ", "czech republic": "CZ", "south korea": "KR", "north korea": "KP", russia: "RU", "méxico": "MX",
  "côte d'ivoire": "CI", "ivory coast": "CI", "bosnia and herzegovina": "BA", "myanmar (burma)": "MM", burma: "MM", eswatini: "SZ", "north macedonia": "MK",
  "democratic republic of the congo": "CD", "republic of the congo": "CG", "cabo verde": "CV", "cape verde": "CV", "the netherlands": "NL", holland: "NL", "viet nam": "VN",
};

/** The country on the end of a Water Share Map place ("Bowmanville, Ontario, Canada") as a code, or null if it is not one we know. */
export function countryCodeFromPlace(place: string | null | undefined): string | null {
  const last = (place ?? "").split(",").pop()?.trim().toLowerCase() ?? "";
  if (!last) return null;
  if (ALIASES[last]) return ALIASES[last];
  if (/^[a-z]{2}$/.test(last) && BY_CODE.has(last.toUpperCase())) return last.toUpperCase();
  for (const c of COUNTRIES) if (countryName(c.code, "en").toLowerCase() === last) return c.code;
  return null;
}

export type CountryRow = { country: string | null; members: number; leads: number };
export type LanguageAdvice = { lang: string; name: string; members: number; countries: { code: string; members: number }[]; recommended: boolean };

/**
 * Languages our members speak that the portal cannot be switched to yet, most members first.
 * "Recommended" once at least 5 members (or 10% of the members who told us) live where that language is spoken.
 */
export function adviseLanguages(rows: CountryRow[]): LanguageAdvice[] {
  const known = rows.filter((r) => r.country && isCountryCode(r.country));
  const total = known.reduce((n, r) => n + r.members, 0);
  const byLang = new Map<string, LanguageAdvice>();
  for (const r of known) {
    const lang = languageOf(r.country!);
    if (SUPPORTED_LANGS.includes(lang) || r.members === 0) continue;
    const a = byLang.get(lang) ?? { lang, name: languageName(lang), members: 0, countries: [], recommended: false };
    a.members += r.members;
    a.countries.push({ code: r.country!, members: r.members });
    byLang.set(lang, a);
  }
  return [...byLang.values()]
    .map((a) => ({ ...a, countries: a.countries.sort((x, y) => y.members - x.members), recommended: a.members >= 5 || (total > 0 && a.members / total >= 0.1) }))
    .sort((a, b) => b.members - a.members);
}
