/* The "quote" a distributor makes for a lead: the products they picked, base prices that cannot be changed,
   the tax and shipping typed in for each product, and the total worked out from all three. */
import { currencyOf, knownCountry, priceOf } from "./prices";

export type QuoteLang = "en" | "es" | "fr" | "it" | "de";
export const QUOTE_LANGS: [QuoteLang, string][] = [["en", "English"], ["es", "Español"], ["fr", "Français"], ["it", "Italiano"], ["de", "Deutsch"]];
export const isQuoteLang = (v: unknown): v is QuoteLang => QUOTE_LANGS.some(([l]) => l === v);

/** What each product is called on the quote (names not listed here are shown as they are). */
const LABEL: Record<string, string> = { K8: "Kangen 8", Anespa: "Anespa DX" };
export const productLabel = (name: string) => LABEL[name] ?? name.replace(/Σ/g, "Σ");
/** The pictures we have (small ones, for the products on the quote). */
const IMAGE: Record<string, string> = { K8: "/quote/k8.png", Anespa: "/quote/anespa.png", "Ukon Sigma": "/quote/ukon.png" };
export const productImage = (name: string): string | null => IMAGE[name] ?? null;

/** What the commission line says for the sets we have figures for (US). Other mixes show no commission line. */
const EARN: Record<string, number> = { "Anespa|K8|Ukon Sigma": 465, "Anespa|K8|K8|Ukon Sigma": 930, "K8|Ukon Sigma": 115 };
const ORDER = ["Anespa", "K8", "Ukon Sigma"];
const rank = (n: string) => { const i = ORDER.indexOf(n); return i < 0 ? 99 : i; };

/** A package is shown on the quote as its products. */
function partsOf(name: string): string[] | null {
  if (/^Quad/.test(name)) return ["Anespa", "K8", "K8", "Ukon Sigma"];
  if (/^Trifecta/.test(name)) return ["Anespa", "K8", "Ukon Sigma"];
  if (/^K8 \+ Ukon/.test(name)) return ["K8", "Ukon Sigma"];
  return null;
}

/** The lines for what was picked (packages shown as their products). Null if any pick has no price yet. */
export function expandSelection(country: string, qty: Record<string, number>): string[] | null {
  const out: string[] = [];
  for (const [name, q] of Object.entries(qty)) {
    if (!q) continue;
    const parts = partsOf(name);
    const useParts = parts && parts.every((p) => priceOf(country, p) !== null);
    for (let i = 0; i < q; i++) {
      if (useParts) out.push(...parts);
      else if (priceOf(country, name) !== null) out.push(name);
      else return null;
    }
  }
  return out.length ? out.slice(0, 24).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)) : null;
}

export type QuoteLine = { name: string; tax: number; shipping: number };
export type QuoteData = { lead: string; lang: QuoteLang; country: string; lines: QuoteLine[] };

export const basePrice = (d: QuoteData, l: QuoteLine) => priceOf(d.country, l.name) ?? 0;
export const lineTotal = (d: QuoteData, l: QuoteLine) => basePrice(d, l) + l.tax + l.shipping;
export const quoteTotal = (d: QuoteData) => d.lines.reduce((n, l) => n + lineTotal(d, l), 0);
const setKey = (d: QuoteData) => d.lines.map((l) => l.name).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).join("|");
export const earnFor = (d: QuoteData): number | null => (d.country === "United States" ? EARN[setKey(d)] ?? null : null);
export const titleKey = (d: QuoteData): string => {
  const k = setKey(d);
  if (d.country === "United States" || k.includes("Ukon")) {
    if (k === "Anespa|K8|K8|Ukon Sigma") return "Quad";
    if (k === "Anespa|K8|Ukon Sigma") return "Trifecta";
    if (k === "K8|Ukon Sigma") return "K8 + Ukon";
  }
  return d.lines.length === 1 ? productLabel(d.lines[0].name) : "";
};

/** Cleans a quote that came from the browser (or an older saved one): only known products with a price, numbers kept sane, name trimmed. */
export function cleanQuote(raw: unknown): QuoteData | null {
  const r = raw as { lead?: unknown; lang?: unknown; country?: unknown; lines?: unknown } | null;
  if (!r || !Array.isArray(r.lines) || r.lines.length === 0 || r.lines.length > 24) return null;
  const country = typeof r.country === "string" ? r.country : "United States";
  if (!knownCountry(country)) return null;
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1_000_000, Math.max(0, Math.round(n * 100) / 100)) : 0; };
  const OLD: Record<string, string> = { anespa: "Anespa", k8: "K8", ukon: "Ukon Sigma" };
  const lines: QuoteLine[] = [];
  for (const l of r.lines as { name?: unknown; key?: unknown; tax?: unknown; shipping?: unknown }[]) {
    const name = typeof l?.name === "string" ? l.name : typeof l?.key === "string" ? OLD[l.key] : undefined;
    if (!name || priceOf(country, name) === null) return null;
    lines.push({ name, tax: num(l.tax), shipping: num(l.shipping) });
  }
  return { lead: String(r.lead ?? "").trim().slice(0, 60), lang: isQuoteLang(r.lang) ? r.lang : "en", country, lines };
}

type Words = { product: string; item: string; tax: string; shipping: string; total: string; totalLine: string; name: string; earn: (x: string) => string; courses: string; title: (n: string, t: string) => string; pkg: string; brand: string };
const de = (n: string) => (/[sßxz]$/i.test(n) ? `${n}'` : `${n}s`);
export const WORDS: Record<QuoteLang, Words> = {
  en: { product: "Product", item: "Item", tax: "Tax", shipping: "Shipping", total: "Total", totalLine: "Total:", name: "Name", earn: (x) => `+ you earn ${x} in commission from your investment`, courses: "+ access to $35k in bonus courses", title: (n, t) => `${n}'s ${t}`, pkg: "Package", brand: "Free Life Collective" },
  es: { product: "Producto", item: "Artículo", tax: "Impuestos", shipping: "Envío", total: "Total", totalLine: "Total:", name: "Nombre", earn: (x) => `+ ganas ${x} en comisión de tu inversión`, courses: "+ acceso a $35k en cursos de bonificación", title: (n, t) => `El ${t} de ${n}`, pkg: "Paquete", brand: "Free Life Collective" },
  fr: { product: "Produit", item: "Article", tax: "Taxe", shipping: "Livraison", total: "Total", totalLine: "Total :", name: "Prénom", earn: (x) => `+ vous gagnez ${x} de commission sur votre investissement`, courses: "+ accès à 35k $ de cours bonus", title: (n, t) => `Le ${t} de ${n}`, pkg: "Pack", brand: "Free Life Collective" },
  it: { product: "Prodotto", item: "Articolo", tax: "Tasse", shipping: "Spedizione", total: "Totale", totalLine: "Totale:", name: "Nome", earn: (x) => `+ guadagni ${x} di commissione dal tuo investimento`, courses: "+ accesso a corsi bonus per $35k", title: (n, t) => `Il ${t} di ${n}`, pkg: "Pacchetto", brand: "Free Life Collective" },
  de: { product: "Produkt", item: "Artikel", tax: "Steuer", shipping: "Versand", total: "Gesamt", totalLine: "Gesamt:", name: "Name", earn: (x) => `+ du verdienst ${x} Provision aus deiner Investition`, courses: "+ Zugang zu Bonuskursen im Wert von $35k", title: (n, t) => `${de(n)} ${t}`, pkg: "Paket", brand: "Free Life Collective" },
};
export const money = (n: number, currency = "USD", cents = false) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(n);
export const moneyIn = (d: QuoteData, n: number, cents = false) => money(n, currencyOf(d.country), cents);
/** A typed amount shown in a table cell: just the currency sign while it is still empty. */
export const cell = (d: QuoteData, n: number) => (n > 0 ? moneyIn(d, n, n % 1 !== 0) : money(0, currencyOf(d.country)).replace(/[\d.,\s]/g, ""));

export function quoteTitle(d: QuoteData): string {
  const w = WORDS[d.lang];
  return w.title(d.lead || w.name, titleKey(d) || w.pkg).toLocaleUpperCase(d.lang);
}
