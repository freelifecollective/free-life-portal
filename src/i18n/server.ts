import "server-only";
import { buildDict, translateText, type Dict, type Lang } from "./match";
import { ENTRIES } from "./entries";

const dicts = new Map<Lang, Dict>();
const isLang = (l: string | null | undefined): l is Lang => l === "es" || l === "fr" || l === "it" || l === "de";

/** The portal's own wording in someone's language, for things made on the server (like phone banners). Anything we have no translation for stays as written. */
export function translateFor(lang: string | null | undefined, text: string | null): string | null {
  if (!text || !isLang(lang)) return text;
  let d = dicts.get(lang);
  if (!d) { d = buildDict(ENTRIES, lang); dicts.set(lang, d); }
  return translateText(text, d) ?? text;
}
