"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLanguages } from "@/app/(app)/call-closer/actions";
import { CALL_LANGUAGES } from "@/lib/languages";

/** The languages a call closer takes calls in: one native language (shown first on their card) and as many others as they like. */
export function LanguagesCard({ native, others }: { native: string | null; others: string[] }) {
  const router = useRouter();
  const [nat, setNat] = useState(native ?? "English");
  const [more, setMore] = useState<string[]>(others);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const toggle = (l: string) => setMore((m) => (m.includes(l) ? m.filter((x) => x !== l) : [...m, l]));
  return (
    <section className="card-s set-form" aria-label="Languages" style={{ maxWidth: 860 }}>
      <h2 className="qh" style={{ margin: 0 }}>Languages</h2>
      <p className="when" style={{ margin: 0 }}>The language you take calls in. Leads you book hear from you in your native language, and your languages show on your card in Call Closers for Hire.</p>
      <div className="field"><label htmlFor="cl-native">My native language</label>
        <select id="cl-native" value={nat} onChange={(e) => { setNat(e.target.value); setMore((m) => m.filter((x) => x !== e.target.value)); setMsg(""); }}>
          {CALL_LANGUAGES.map((l) => <option key={l} value={l} translate="no">{l}</option>)}
        </select></div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ padding: 0, marginBottom: 6, fontWeight: 600 }}>Other languages I can take calls in</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
          {CALL_LANGUAGES.filter((l) => l !== nat).map((l) => (
            <label key={l} className="check" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={more.includes(l)} onChange={() => { toggle(l); setMsg(""); }} /> <span translate="no">{l}</span></label>
          ))}
        </div>
      </fieldset>
      <div className="set-actions"><button type="button" className="btn primary" disabled={pending} onClick={() => start(async () => { const r = await saveLanguages(nat, more); setMsg(r.ok ? "Saved." : r.error ?? ""); if (r.ok) router.refresh(); })}>Save languages</button><span role="status" className="when">{msg}</span></div>
    </section>
  );
}
