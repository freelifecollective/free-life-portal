/** The languages people can switch the portal into. Mexican Spanish speakers use Español. */
export const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
] as const;
export type LangCode = (typeof LANGS)[number]["code"];

const KEY = "flc_lang";
const valid = (v: string | null | undefined): v is LangCode => !!v && LANGS.some((l) => l.code === v);

/** The language chosen on this device (English if none). */
export function currentLang(): LangCode {
  try {
    const m = document.cookie.match(/(?:^|; )flc_lang=([a-z]{2})/);
    if (valid(m?.[1])) return m![1] as LangCode;
  } catch { /* cookies blocked */ }
  try { const s = localStorage.getItem(KEY); if (valid(s)) return s; } catch { /* storage blocked */ }
  return "en";
}

/** Switches the whole portal to a language and reloads the page so it takes effect. */
export function setLanguage(code: LangCode) {
  try { localStorage.setItem(KEY, code); } catch { /* fine */ }
  try { document.cookie = `flc_lang=${code}; path=/; max-age=31536000; samesite=lax`; } catch { /* fine */ }
  /* tell the portal too (when signed in), so phone banners come in this language; the page reloads either way */
  fetch("/api/language", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: code }), keepalive: true })
    .catch(() => {}).finally(() => location.reload());
}
