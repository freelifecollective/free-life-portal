"use client";

import { useSyncExternalStore } from "react";
import { currentLang, type LangCode } from "@/lib/language";

/** In another language the video is still in English, so tell people (in their language) to switch the captions on. Nothing shows in English. */
const HINT: Record<Exclude<LangCode, "en">, string> = {
  es: "Selecciona Español en la lista de subtítulos (CC) del video.",
  fr: "Sélectionnez Français dans la liste des sous-titres (CC) de la vidéo.",
  it: "Seleziona Italiano nell'elenco dei sottotitoli (CC) del video.",
  de: "Wähle Deutsch in der Untertitel-Liste (CC) des Videos aus.",
};
const subscribe = () => () => {};

export function CaptionHint() {
  const lang = useSyncExternalStore(subscribe, currentLang, () => "en" as LangCode);
  if (lang === "en") return null;
  return <p className="lpn-cc" data-i18n="skip" lang={lang}>{HINT[lang]}</p>;
}
