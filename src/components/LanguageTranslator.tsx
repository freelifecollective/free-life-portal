"use client";

import { useEffect } from "react";
import { currentLang, restoreLanguage } from "@/lib/language";

declare global {
  interface Window { googleTranslateElementInit?: () => void; google?: { translate: { TranslateElement: new (o: object, id: string) => unknown } } }
}

/**
 * Loads the translation service, but only for people who picked a language other than English, so English readers never touch it.
 * The service rewrites the text on the page; two small guards stop React from stumbling over the rewritten text.
 */
export function LanguageTranslator() {
  useEffect(() => {
    if (restoreLanguage()) { location.reload(); return; }
    if (currentLang() === "en") return;

    /* React and page translators both move text around; this keeps React from crashing when a translated piece is no longer where it expects */
    const proto = Node.prototype as Node & { __flcPatched?: boolean };
    if (!proto.__flcPatched) {
      proto.__flcPatched = true;
      const remove = Node.prototype.removeChild;
      Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
        if (child.parentNode !== this) return child;
        return remove.call(this, child) as T;
      };
      const insert = Node.prototype.insertBefore;
      Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
        if (ref && ref.parentNode !== this) return node;
        return insert.call(this, node, ref) as T;
      };
    }

    window.googleTranslateElementInit = () => {
      if (!window.google) return;
      new window.google.translate.TranslateElement({ pageLanguage: "en", includedLanguages: "es,fr,it,de", autoDisplay: false }, "google_translate_element");
    };
    const s = document.createElement("script");
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  /* the service needs an element to live in; it stays invisible */
  return <div id="google_translate_element" className="notranslate" aria-hidden="true" style={{ display: "none" }} />;
}
