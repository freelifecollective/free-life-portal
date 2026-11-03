"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createQuote } from "@/app/(app)/calculator/actions";
import { QuoteCard } from "@/components/quote/QuoteCard";
import { drawQuote } from "@/lib/quote/draw";
import { lineTotal, money, PRODUCT_LABEL, QUOTE_LANGS, quoteTotal, type ProductKey, type QuoteData, type QuoteLang } from "@/lib/quote/model";

const portalLang = (): QuoteLang => {
  try { const m = document.cookie.match(/(?:^|; )flc_lang=([^;]+)/); const l = m?.[1]; if (l === "es" || l === "fr" || l === "it" || l === "de") return l; } catch { /* use English */ }
  return "en";
};

/** Under the products: make a quote for a lead. Base prices are fixed; the distributor types the lead's name, the tax and the shipping, and the total follows. */
export function QuoteBuilder({ products }: { products: ProductKey[] }) {
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState("");
  const [lang, setLang] = useState<QuoteLang>(portalLang);
  const [extra, setExtra] = useState<Record<string, { tax: string; shipping: string }>>({});
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState<{ sig: string; url: string } | null>(null);
  const [pending, start] = useTransition();
  const card = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const num = (s: string | undefined) => { const n = Number((s ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? Math.min(1_000_000, n) : 0; };
  const data: QuoteData = useMemo(() => ({ lead: lead.trim(), lang, lines: products.map((key, i) => ({ key, tax: num(extra[`${key}-${i}`]?.tax), shipping: num(extra[`${key}-${i}`]?.shipping) })) }), [lead, lang, products, extra]);
  const sig = JSON.stringify(data);
  const set = (id: string, f: "tax" | "shipping", v: string) => { setExtra((s) => ({ ...s, [id]: { tax: s[id]?.tax ?? "", shipping: s[id]?.shipping ?? "", [f]: v } })); setMsg(""); };

  async function download() {
    if (!card.current) return;
    try {
      const blob = await drawQuote(card.current);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `quote${data.lead ? "-" + data.lead.replace(/[^\p{L}\p{N}]+/gu, "-") : ""}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { setMsg("We could not make the picture. Please try again."); }
  }
  function shareLink(then: (url: string) => void) {
    if (link && link.sig === sig) { then(link.url); return; }
    start(async () => {
      const r = await createQuote(data);
      if (!r.ok) { setMsg(r.error); return; }
      const url = `${location.origin}/q/${r.token}`;
      setLink({ sig, url }); then(url);
    });
  }
  const share = () => shareLink(async (url) => {
    try { if (navigator.share) { await navigator.share({ title: "Your quote", url }); return; } } catch { return; /* closed the share sheet */ }
    try { await navigator.clipboard.writeText(url); setMsg("Link copied ✓"); } catch { setMsg(url); }
  });
  const copy = () => shareLink(async (url) => { try { await navigator.clipboard.writeText(url); setMsg("Link copied ✓"); } catch { setMsg(url); } });

  return (
    <div className="qb">
      {!open ? (
        <button type="button" className="btn primary" onClick={() => { setOpen(true); setTimeout(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>Make a quote for your lead</button>
      ) : (
        <div ref={panel} className="qb-panel">
          <h2 className="qh" style={{ marginTop: 0 }}>Quote for your lead</h2>
          <div className="qb-top">
            <div className="field"><label htmlFor="qb-name">Your lead&apos;s name</label><input id="qb-name" value={lead} maxLength={60} autoComplete="off" onChange={(e) => { setLead(e.target.value); setMsg(""); }} /></div>
            <div className="field"><label htmlFor="qb-lang">Language of the quote</label>
              <select id="qb-lang" value={lang} onChange={(e) => setLang(e.target.value as QuoteLang)} data-i18n="skip">{QUOTE_LANGS.map(([l, n]) => <option key={l} value={l}>{n}</option>)}</select></div>
          </div>
          <div className="table-wrap">
            <table className="admin-table qb-table">
              <thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">Tax</th><th scope="col">Shipping</th><th scope="col">Total</th></tr></thead>
              <tbody>
                {data.lines.map((l, i) => {
                  const id = `${l.key}-${i}`;
                  return (
                    <tr key={id}>
                      <td data-i18n="skip"><strong>{PRODUCT_LABEL[l.key]}</strong></td>
                      <td>{money(lineTotal({ ...l, tax: 0, shipping: 0 }))}</td>
                      <td><label className="sr-only" htmlFor={`qb-t-${id}`}>Tax for {PRODUCT_LABEL[l.key]}</label><span className="qb-in">$<input id={`qb-t-${id}`} inputMode="decimal" value={extra[id]?.tax ?? ""} placeholder="0" onChange={(e) => set(id, "tax", e.target.value)} /></span></td>
                      <td><label className="sr-only" htmlFor={`qb-s-${id}`}>Shipping for {PRODUCT_LABEL[l.key]}</label><span className="qb-in">$<input id={`qb-s-${id}`} inputMode="decimal" value={extra[id]?.shipping ?? ""} placeholder="0" onChange={(e) => set(id, "shipping", e.target.value)} /></span></td>
                      <td><strong>{money(lineTotal(l), true)}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td colSpan={4} style={{ textAlign: "right" }}><strong>Total</strong></td><td><strong>{money(quoteTotal(data), true)}</strong></td></tr></tfoot>
            </table>
          </div>
          <div className="qb-card" ref={card}><QuoteCard data={data} id="quote-card" /></div>
          <div className="qb-actions">
            <button type="button" className="btn primary" onClick={download}>Download picture</button>
            <button type="button" className="btn" disabled={pending} onClick={share}>{pending ? "Making the link…" : "Share"}</button>
            <button type="button" className="btn" disabled={pending} onClick={copy}>Copy link</button>
            <button type="button" className="linkbtn" onClick={() => setOpen(false)}>Close</button>
            <span className="when" role="status">{msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
