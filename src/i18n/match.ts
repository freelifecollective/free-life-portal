/** The matching rules for the portal's own translations. Pure functions, so they can be tested without a browser. */
export type Lang = "es" | "fr" | "it" | "de";
export type Entry = readonly [en: string, es: string, fr: string, it: string, de: string];
export type Dict = { exact: Map<string, string>; patterns: { re: RegExp; to: string }[]; lang: Lang };

const INDEX: Record<Lang, number> = { es: 1, fr: 2, it: 3, de: 4 };

/** Same text whatever the quote style or spacing, so "Don’t  worry" and "Don't worry" find the same entry. */
export function norm(s: string): string {
  return s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
}

export function buildDict(entries: readonly Entry[], lang: Lang): Dict {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; to: string }[] = [];
  const i = INDEX[lang];
  for (const e of entries) {
    const en = norm(e[0]);
    const to = e[i];
    if (!to) continue;
    if (/\{\d\}/.test(en)) {
      const src = en.split(/(\{\d\})/).map((part) => (/^\{\d\}$/.test(part) ? "(.+?)" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("");
      patterns.push({ re: new RegExp("^" + src + "$"), to });
    } else exact.set(en, to);
  }
  /* longer patterns first, so the most specific one wins */
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exact, patterns, lang };
}

const WEEK: Record<Lang, string[]> = {
  es: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"], fr: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
  it: ["lun", "mar", "mer", "gio", "ven", "sab", "dom"], de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};
const WEEK_LONG: Record<Lang, string[]> = {
  es: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"], fr: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
  it: ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"], de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
};
const MONTH: Record<Lang, string[]> = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"], fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  it: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"], de: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."],
};
const MONTH_LONG: Record<Lang, string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
const EN_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EN_WEEK_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EN_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Dates written by the portal ("Mon, Nov 2, 5:30 PM EST", "September 6, 1991", "last seen Oct 12") in the reader's language.
 * Only text that really looks like a date is touched.
 */
export function translateDates(text: string, lang: Lang): string | null {
  const monthRe = "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)";
  const weekRe = "(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
  /* a lone weekday ("Sun") or a month with its year ("November 2026"), like the headings of the calendar */
  const lone = text.trim();
  const li = EN_WEEK_LONG.indexOf(lone), si = EN_WEEK.indexOf(lone);
  if (li >= 0 || si >= 0) return text.replace(lone, li >= 0 ? WEEK_LONG[lang][li] : WEEK[lang][si]);
  const mi = EN_MONTH_LONG.indexOf(lone);
  if (mi >= 0) return text.replace(lone, MONTH_LONG[lang][mi]);
  const my = lone.match(/^([A-Z][a-z]+) (\d{4})$/);
  if (my && EN_MONTH_LONG.includes(my[1])) return text.replace(lone, `${MONTH_LONG[lang][EN_MONTH_LONG.indexOf(my[1])]}${lang === "es" ? " de" : ""} ${my[2]}`);
  const monthDay = new RegExp(`\\b${monthRe}\\.? (\\d{1,2})(?!\\d)`, "g");
  const looksLikeDate = monthDay.test(text) || new RegExp(`\\b${weekRe},? ${monthRe}\\b`).test(text) || new RegExp(`\\b${weekRe}\\b.*\\d{1,2}:\\d{2}`).test(text);
  if (!looksLikeDate) return null;
  let out = text.replace(new RegExp(`\\b${monthRe}\\.? (\\d{1,2})(?!\\d)`, "g"), (whole, mon: string, d: string) => {
    const longIdx = EN_MONTH_LONG.indexOf(mon);
    const idx = longIdx >= 0 ? longIdx : EN_MONTH.indexOf(mon === "Sept" ? "Sep" : mon);
    if (idx < 0) return whole;
    const name = longIdx >= 0 ? MONTH_LONG[lang][idx] : MONTH[lang][idx];
    if (lang === "de") return `${d}. ${name}`;
    return lang === "es" && longIdx >= 0 ? `${d} de ${name}` : `${d} ${name}`;
  });
  out = out.replace(new RegExp(`\\b${weekRe}\\b`, "g"), (w: string) => {
    const li = EN_WEEK_LONG.indexOf(w);
    if (li >= 0) return WEEK_LONG[lang][li];
    const si = EN_WEEK.indexOf(w);
    return si >= 0 ? WEEK[lang][si] : w;
  });
  /* a bare long month name left over (e.g. "September" before a year) */
  out = out.replace(new RegExp(`\\b${monthRe}\\b`, "g"), (m: string) => { const i = EN_MONTH_LONG.indexOf(m); return i >= 0 ? MONTH_LONG[lang][i] : m; });
  /* "Monday, Nov 3 at 4:00 PM ET" */
  out = out.replace(/ at (\d{1,2}:\d{2})/g, (_w, t: string) => ` ${{ es: "a las", fr: "à", it: "alle", de: "um" }[lang]} ${t}`);
  return out === text ? null : out;
}

/** The translation of one piece of text, or null when we have none (so it is left exactly as it is). */
export function translateText(text: string, dict: Dict): string | null {
  const lead = text.match(/^\s*/)?.[0] ?? "";
  const trail = text.match(/\s*$/)?.[0] ?? "";
  const core = norm(text);
  if (!core || !/[A-Za-z]/.test(core)) return null;
  const hit = dict.exact.get(core);
  if (hit !== undefined) return lead + hit + trail;
  for (const p of dict.patterns) {
    const m = core.match(p.re);
    if (!m) continue;
    const args = m.slice(1).map((a) => dict.exact.get(norm(a)) ?? translateDates(norm(a), dict.lang) ?? a);
    return lead + p.to.replace(/\{(\d)\}/g, (_x, n: string) => args[Number(n)] ?? "") + trail;
  }
  const d = translateDates(core, dict.lang);
  return d === null ? null : lead + d + trail;
}
