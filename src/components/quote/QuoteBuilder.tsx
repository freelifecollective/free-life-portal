"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createQuote, emailQuote, myLeadChoices, type LeadChoice } from "@/app/(app)/calculator/actions";
import { QuoteCard } from "@/components/quote/QuoteCard";
import { drawQuote } from "@/lib/quote/draw";
import { basePrice, lineTotal, moneyIn, productLabel, QUOTE_LANGS, quoteTotal, type QuoteData, type QuoteLang } from "@/lib/quote/model";

const OTHER = "__other";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const portalLang = (): QuoteLang => {
  try { const m = document.cookie.match(/(?:^|; )flc_lang=([^;]+)/); const l = m?.[1]; if (l === "es" || l === "fr" || l === "it" || l === "de") return l; } catch { /* use English */ }
  return "en";
};

/** Pick one of your leads, or type one in. Used at the top of the quote and again in the email pop-up when no lead was picked yet. */
function LeadSelect({ id, leads, choice, setChoice, name, setName, email, setEmail, showEmail }: {
  id: string; leads: LeadChoice[] | null; choice: string; setChoice: (v: string) => void; name: string; setName: (v: string) => void; email: string; setEmail: (v: string) => void; showEmail: boolean;
}) {
  return (
    <>
      <div className="field"><label htmlFor={`${id}-lead`}>Your lead</label>
        <select id={`${id}-lead`} value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">{leads === null ? "Loading your leads…" : "Choose your lead"}</option>
          {(leads ?? []).map((l) => <option key={l.email} value={l.email} data-i18n="skip">{l.name ? `${l.name} (${l.email})` : l.email}</option>)}
          <option value={OTHER}>My lead isn&apos;t on this list</option>
        </select></div>
      {choice === OTHER ? (
        <>
          <div className="field"><label htmlFor={`${id}-name`}>Your lead&apos;s first name</label><input id={`${id}-name`} value={name} maxLength={60} autoComplete="off" onChange={(e) => setName(e.target.value)} /></div>
          {showEmail ? <div className="field"><label htmlFor={`${id}-email`}>Your lead&apos;s email</label><input id={`${id}-email`} type="email" value={email} maxLength={254} autoComplete="off" onChange={(e) => setEmail(e.target.value)} /></div> : null}
        </>
      ) : null}
    </>
  );
}

/** Make a quote for a lead. Base prices are fixed; the distributor picks the lead, then types the tax and the shipping, and the total follows. */
export function QuoteBuilder({ country, products }: { country: string; products: string[] }) {
  const [leads, setLeads] = useState<LeadChoice[] | null>(null);
  const [choice, setChoice] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherEmail, setOtherEmail] = useState("");
  const [lang, setLang] = useState<QuoteLang>(portalLang);
  const [extra, setExtra] = useState<Record<string, { tax: string; shipping: string }>>({});
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState<{ sig: string; url: string } | null>(null);
  const [pending, start] = useTransition();
  const card = useRef<HTMLDivElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { void myLeadChoices().then(setLeads).catch(() => setLeads([])); }, []);

  const picked = (leads ?? []).find((l) => l.email === choice);
  const leadName = (choice === OTHER ? otherName : picked?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const leadEmail = (choice === OTHER ? otherEmail : picked?.email ?? "").trim();
  const num = (s: string | undefined) => { const n = Number((s ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? Math.min(1_000_000, n) : 0; };
  const data: QuoteData = useMemo(() => ({ lead: leadName, lang, country, lines: products.map((name, i) => ({ name, tax: num(extra[`${name}-${i}`]?.tax), shipping: num(extra[`${name}-${i}`]?.shipping) })) }), [leadName, lang, country, products, extra]);
  const sig = JSON.stringify(data);
  const set = (id: string, f: "tax" | "shipping", v: string) => { setExtra((s) => ({ ...s, [id]: { tax: s[id]?.tax ?? "", shipping: s[id]?.shipping ?? "", [f]: v } })); setMsg(""); };

  async function download() {
    if (!card.current) return;
    try {
      const blob = await drawQuote(card.current);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `quote${leadName ? "-" + leadName.replace(/[^\p{L}\p{N}]+/gu, "-") : ""}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { setMsg("We could not make the picture. Please try again."); }
  }
  function withLink(then: (url: string) => void) {
    if (link && link.sig === sig) { then(link.url); return; }
    start(async () => {
      const r = await createQuote(data);
      if (!r.ok) { setMsg(r.error); return; }
      const url = `${location.origin}/q/${r.token}`;
      setLink({ sig, url }); then(url);
    });
  }
  const shareLink = () => withLink(async (url) => {
    try { if (navigator.share) { await navigator.share({ title: "Your quote", url }); return; } } catch { return; /* closed the share sheet */ }
    try { await navigator.clipboard.writeText(url); setMsg("Link copied ✓"); } catch { setMsg(url); }
  });
  function sendEmail() {
    if (!EMAIL.test(leadEmail)) return;
    start(async () => {
      const r = await emailQuote(data, leadEmail, leadName);
      if (r.ok) { dlg.current?.close(); setMsg(`Email sent to ${leadEmail} ✓`); } else setMsg(r.error);
    });
  }
  const ready = choice !== "" && EMAIL.test(leadEmail);
  const sel = { leads, choice, setChoice: (v: string) => { setChoice(v); setMsg(""); }, name: otherName, setName: setOtherName, email: otherEmail, setEmail: setOtherEmail };

  return (
    <div className="qb">
      <div className="qb-panel">
        <div className="qb-top">
          <LeadSelect id="qb" {...sel} showEmail={false} />
          <div className="field"><label htmlFor="qb-lang">Language of the quote</label>
            <select id="qb-lang" value={lang} onChange={(e) => setLang(e.target.value as QuoteLang)} data-i18n="skip">{QUOTE_LANGS.map(([l, n]) => <option key={l} value={l}>{n}</option>)}</select></div>
        </div>
        <div className="table-wrap">
          <table className="admin-table qb-table">
            <thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">Tax</th><th scope="col">Shipping</th><th scope="col">Total</th></tr></thead>
            <tbody>
              {data.lines.map((l, i) => {
                const id = `${l.name}-${i}`;
                return (
                  <tr key={id}>
                    <td data-i18n="skip"><strong>{productLabel(l.name)}</strong></td>
                    <td>{moneyIn(data, basePrice(data, l))}</td>
                    <td><label className="sr-only" htmlFor={`qb-t-${i}`}>Tax for {productLabel(l.name)}</label><input id={`qb-t-${i}`} className="qb-num" inputMode="decimal" value={extra[id]?.tax ?? ""} placeholder="0" onChange={(e) => set(id, "tax", e.target.value)} /></td>
                    <td><label className="sr-only" htmlFor={`qb-s-${i}`}>Shipping for {productLabel(l.name)}</label><input id={`qb-s-${i}`} className="qb-num" inputMode="decimal" value={extra[id]?.shipping ?? ""} placeholder="0" onChange={(e) => set(id, "shipping", e.target.value)} /></td>
                    <td><strong>{moneyIn(data, lineTotal(data, l), true)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><td colSpan={4} style={{ textAlign: "right" }}><strong>Total</strong></td><td><strong>{moneyIn(data, quoteTotal(data), true)}</strong></td></tr></tfoot>
          </table>
        </div>
        <div className="qb-card" ref={card}><QuoteCard data={data} id="quote-card" /></div>
        <div className="qb-actions">
          <button type="button" className="btn primary" onClick={download}>Download</button>
          <button type="button" className="btn" disabled={pending} onClick={() => { setMsg(""); dlg.current?.showModal(); }}>Email</button>
          <button type="button" className="btn" disabled={pending} onClick={shareLink}>{pending ? "Making the link…" : "Share Link"}</button>
          <span className="when" role="status">{msg}</span>
        </div>
      </div>
      <dialog ref={dlg} className="rs-dialog" aria-labelledby="qb-dlg-title">
        <h2 id="qb-dlg-title" className="qh" style={{ marginTop: 0 }}>Email this quote</h2>
        {ready ? (
          <p>Send this quote to <strong translate="no">{leadName || leadEmail}</strong> at <strong translate="no">{leadEmail}</strong>?</p>
        ) : (
          <>
            <p>{choice === "" ? "Choose which lead should get this quote." : "Add your lead's email so we can send it."}</p>
            <LeadSelect id="qb-d" {...sel} showEmail />
          </>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancel</button>
          <button type="button" className="btn primary" disabled={pending || !ready} onClick={sendEmail}>{pending ? "Sending…" : "Send email"}</button>
        </div>
      </dialog>
    </div>
  );
}
