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

/** The language chosen on this device (English if none). The translation service reads the same "googtrans" cookie. */
export function currentLang(): LangCode {
  try {
    const m = document.cookie.match(/(?:^|; )googtrans=\/[a-z-]+\/([a-z-]+)/);
    const code = m?.[1];
    if (code && LANGS.some((l) => l.code === code)) return code as LangCode;
  } catch { /* cookies blocked */ }
  return "en";
}

function writeCookie(value: string | null) {
  const host = location.hostname;
  const expiry = value === null ? "; expires=Thu, 01 Jan 1970 00:00:00 GMT" : "; max-age=31536000";
  const v = value ?? "";
  document.cookie = `googtrans=${v}; path=/${expiry}`;
  /* the translation service also sets it for the whole domain, so clear/set that one too */
  if (host.includes(".")) document.cookie = `googtrans=${v}; path=/; domain=.${host.replace(/^www\./, "")}${expiry}`;
}

/** Switches the whole portal to a language and reloads the page so it takes effect. */
export function setLanguage(code: LangCode) {
  try { localStorage.setItem(KEY, code); } catch { /* fine */ }
  writeCookie(code === "en" ? null : `/en/${code}`);
  location.reload();
}

/** If the cookie was lost (cleared) but this device remembers a choice, put it back. */
export function restoreLanguage(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved !== "en" && LANGS.some((l) => l.code === saved) && currentLang() === "en") { writeCookie(`/en/${saved}`); return true; }
  } catch { /* fine */ }
  return false;
}
