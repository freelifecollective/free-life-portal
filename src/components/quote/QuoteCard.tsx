/* eslint-disable @next/next/no-img-element */
import { cell, earnFor, lineTotal, money, PRODUCT_IMAGE, PRODUCT_LABEL, quoteTitle, quoteTotal, WORDS, type QuoteData } from "@/lib/quote/model";

/** The quote as the lead sees it. Sizes follow the width of the card, so it looks the same large or small (and in the saved picture). */
export function QuoteCard({ data, id }: { data: QuoteData; id?: string }) {
  const w = WORDS[data.lang];
  const earn = earnFor(data);
  return (
    <div className="qc-wrap" id={id}>
      <div className="qc" translate="no" data-i18n="skip" lang={data.lang}>
        <div className="qc-frame">
          <div className="qc-body">
            <h2 className="qc-title">{quoteTitle(data)}</h2>
            <div className="qc-imgs">{data.lines.map((l, i) => <img key={i} src={PRODUCT_IMAGE[l.key]} alt="" />)}</div>
            <table className="qc-table">
              <thead><tr><th>{w.product}</th><th>{w.item}</th><th>{w.tax}</th><th>{w.shipping}</th><th>{w.total}</th></tr></thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i}><td className="p">{PRODUCT_LABEL[l.key]}</td><td>{money(lineTotal({ ...l, tax: 0, shipping: 0 }))}</td><td>{cell(l.tax)}</td><td>{cell(l.shipping)}</td><td>{money(lineTotal(l), lineTotal(l) % 1 !== 0)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="qc-total">{w.totalLine}&nbsp; {money(quoteTotal(data), true)}</p>
            {earn ? <p className="qc-note">{w.earn(money(earn))}</p> : null}
            <p className="qc-note">{w.courses}</p>
          </div>
          <span className="qc-brand">{w.brand.toLocaleUpperCase(data.lang)}</span>
        </div>
      </div>
    </div>
  );
}
