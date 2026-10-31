"use client";

import { useEffect } from "react";
import { currentLang } from "@/lib/language";
import type { Lang } from "@/i18n/match";

/** Puts the page into the language this person chose. English readers never load any of it. */
export function LanguageTranslator() {
  useEffect(() => {
    const lang = currentLang();
    if (lang === "en") return;
    let stop: (() => void) | null = null;
    let live = true;
    void (async () => {
      const { loadDict, startTranslator } = await import("@/i18n/engine");
      const dict = await loadDict(lang as Lang);
      if (live) stop = startTranslator(lang as Lang, dict);
    })();
    return () => { live = false; stop?.(); };
  }, []);
  return null;
}
