"use client";

import { useMemo, useSyncExternalStore } from "react";
import { COUNTRIES, countryName } from "@/lib/countries";
import { currentLang } from "@/lib/language";

const noop = () => () => {};

/** A dropdown of every country, named in the language the portal is showing. The value is the two-letter country code. */
export function CountrySelect({ id, name, value, defaultValue, onChange, placeholder = "Choose your country" }: {
  id: string; name?: string; value?: string; defaultValue?: string; onChange?: (code: string) => void; placeholder?: string;
}) {
  const lang = useSyncExternalStore(noop, currentLang, () => "en");
  const list = useMemo(() => COUNTRIES.map((c) => ({ code: c.code, label: countryName(c.code, lang) })).sort((a, b) => a.label.localeCompare(b.label, lang)), [lang]);
  const props = value !== undefined ? { value } : { defaultValue: defaultValue ?? "" };
  return (
    <select id={id} name={name} {...props} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
      <option value="">{placeholder}</option>
      {list.map((c) => <option key={c.code} value={c.code} data-i18n="skip">{c.label}</option>)}
    </select>
  );
}
