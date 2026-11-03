/* The "quote" a distributor makes for a lead: the products they picked in the Earnings Estimator, base prices that cannot be changed,
   the tax and shipping typed in for each product, and the total worked out from all three. Prices are in US dollars. */

export type QuoteLang = "en" | "es" | "fr" | "it" | "de";
export const QUOTE_LANGS: [QuoteLang, string][] = [["en", "English"], ["es", "Español"], ["fr", "Français"], ["it", "Italiano"], ["de", "Deutsch"]];
export const isQuoteLang = (v: unknown): v is QuoteLang => QUOTE_LANGS.some(([l]) => l === v);

export type ProductKey = "anespa" | "k8" | "ukon";
/** Base prices. To change a price, change it here (and only here). */
export const BASE_PRICE: Record<ProductKey, number> = { anespa: 3180, k8: 5480, ukon: 2580 };
export const PRODUCT_LABEL: Record<ProductKey, string> = { anespa: "Anespa DX", k8: "Kangen 8", ukon: "Ukon Sigma" };
export const PRODUCT_IMAGE: Record<ProductKey, string> = { anespa: "/quote/anespa.png", k8: "/quote/k8.png", ukon: "/quote/ukon.png" };
const ORDER: ProductKey[] = ["anespa", "k8", "k8", "ukon"];

/** What the commission line says for the sets we have figures for. Other mixes show no commission line. */
const EARN: Record<string, number> = { "k8,ukon": 115, "anespa,k8,ukon": 465, "anespa,k8,k8,ukon": 930 };

/** The products inside an Earnings Estimator choice, or null when we have no base prices for it. */
export function expandProduct(name: string): ProductKey[] | null {
  if (/^Quad/.test(name)) return ["anespa", "k8", "k8", "ukon"];
  if (/^Trifecta/.test(name)) return ["anespa", "k8", "ukon"];
  if (/^K8 \+ Ukon/.test(name)) return ["k8", "ukon"];
  if (name === "K8") return ["k8"];
  if (name === "Anespa") return ["anespa"];
  if (name === "Ukon Sigma") return ["ukon"];
  return null;
}

/** The list of products for everything picked (each picked item repeated by its quantity). Null if any pick has no base price. */
export function expandSelection(qty: Record<string, number>): ProductKey[] | null {
  const out: ProductKey[] = [];
  for (const [name, q] of Object.entries(qty)) {
    if (!q) continue;
    const parts = expandProduct(name);
    if (!parts) return null;
    for (let i = 0; i < q; i++) out.push(...parts);
  }
  return out.length ? out.slice(0, 24).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) : null;
}

export type QuoteLine = { key: ProductKey; tax: number; shipping: number };
export type QuoteData = { lead: string; lang: QuoteLang; lines: QuoteLine[] };

export const lineTotal = (l: QuoteLine) => BASE_PRICE[l.key] + l.tax + l.shipping;
export const quoteTotal = (d: QuoteData) => d.lines.reduce((n, l) => n + lineTotal(l), 0);
export const earnFor = (d: QuoteData): number | null => EARN[d.lines.map((l) => l.key).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(",")] ?? null;
export const titleKey = (d: QuoteData): "quad" | "trifecta" | "k8ukon" | "package" | ProductKey => {
  const k = d.lines.map((l) => l.key).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(",");
  if (k === "anespa,k8,k8,ukon") return "quad";
  if (k === "anespa,k8,ukon") return "trifecta";
  if (k === "k8,ukon") return "k8ukon";
  return d.lines.length === 1 ? d.lines[0].key : "package";
};

/** Cleans a quote that came from the browser: only known products, numbers kept sane, name trimmed. */
export function cleanQuote(raw: unknown): QuoteData | null {
  const r = raw as { lead?: unknown; lang?: unknown; lines?: unknown } | null;
  if (!r || !Array.isArray(r.lines) || r.lines.length === 0 || r.lines.length > 24) return null;
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1_000_000, Math.max(0, Math.round(n * 100) / 100)) : 0; };
  const lines: QuoteLine[] = [];
  for (const l of r.lines as { key?: unknown; tax?: unknown; shipping?: unknown }[]) {
    if (l?.key !== "anespa" && l?.key !== "k8" && l?.key !== "ukon") return null;
    lines.push({ key: l.key, tax: num(l.tax), shipping: num(l.shipping) });
  }
  return { lead: String(r.lead ?? "").trim().slice(0, 60), lang: isQuoteLang(r.lang) ? r.lang : "en", lines };
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
export const money = (n: number, cents = false) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(n);
/** A typed amount shown in a table cell: just "$" while it is still empty. */
export const cell = (n: number) => (n > 0 ? money(n, n % 1 !== 0) : "$");

export function quoteTitle(d: QuoteData): string {
  const w = WORDS[d.lang];
  const k = titleKey(d);
  const t = k === "quad" ? "Quad" : k === "trifecta" ? "Trifecta" : k === "k8ukon" ? "K8 + Ukon" : k === "package" ? w.pkg : PRODUCT_LABEL[k];
  return w.title(d.lead || w.name, t).toLocaleUpperCase(d.lang);
}
