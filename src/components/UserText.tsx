"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { currentLang } from "@/lib/language";

const done = new Map<string, { text: string; same: boolean }>();
const noop = () => () => {};

/** Text a member wrote. For people using another language it is translated by Google Translate, with a link to see the original. */
export function UserText({ text, publicCall }: { text: string; publicCall?: { id: string; field: "title" | "description" } }) {
  const lang = useSyncExternalStore(noop, currentLang, () => "en");
  const pcId = publicCall?.id, pcField = publicCall?.field;
  const key = lang + "\n" + text;
  const [got, setGot] = useState<{ key: string; text: string; same: boolean } | null>(null);
  const [orig, setOrig] = useState(false);
  useEffect(() => {
    if (!/\p{L}/u.test(text)) return;
    const hit = done.get(key);
    if (hit) { Promise.resolve().then(() => setGot({ key, ...hit })); return; }
    let live = true;
    fetch(pcId ? "/api/translate-public" : "/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pcId ? { callId: pcId, field: pcField, to: lang } : { text, to: lang }) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; text?: string; same?: boolean }) => {
        if (!j.ok || typeof j.text !== "string") return;
        const v = { text: j.text, same: !!j.same };
        done.set(key, v);
        if (live) setGot({ key, ...v });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [key, lang, text, pcId, pcField]);
  const t = got && got.key === key && !got.same ? got : null;
  if (!t) return <span data-i18n="skip" translate="no">{text}</span>;
  return (
    <>
      <span data-i18n="skip" translate="no">{orig ? text : t.text}</span>
      <button type="button" className="linkbtn ut-toggle" onClick={() => setOrig((o) => !o)}>{orig ? "Show translation" : "Translated · Show original"}</button>
    </>
  );
}
