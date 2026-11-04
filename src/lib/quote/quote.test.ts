import { describe, expect, it } from "vitest";
import { cleanQuote, earnFor, expandSelection, moneyIn, quoteTitle, quoteTotal } from "./model";

describe("quote", () => {
  it("expands packages into their products", () => {
    expect(expandSelection("United States", { "Quad (Anespa, K8 x2, Ukon Σ)": 1 })).toEqual(["Anespa", "K8", "K8", "Ukon Sigma"]);
    expect(expandSelection("United States", { K8: 2 })).toEqual(["K8", "K8"]);
    expect(expandSelection("United States", { SD501U: 1 })).toBeNull();
    expect(expandSelection("Canada", { K8: 1 })).toBeNull();
    expect(expandSelection("United States", {})).toBeNull();
  });
  it("adds base price, tax and shipping", () => {
    const d = cleanQuote({ lead: "  Ana ", lang: "es", country: "United States", lines: [{ name: "K8", tax: 100, shipping: "50.5" }, { name: "Ukon Sigma", tax: 0, shipping: 0 }] })!;
    expect(d.lead).toBe("Ana");
    expect(quoteTotal(d)).toBe(5480 + 100 + 50.5 + 2580);
    expect(earnFor(d)).toBe(115);
    expect(quoteTitle(d)).toBe("EL K8 + UKON DE ANA");
    expect(moneyIn(d, 5480)).toBe("$5,480");
  });
  it("refuses anything that is not a known product with a price", () => {
    expect(cleanQuote({ lines: [{ name: "evil", tax: 1, shipping: 1 }] })).toBeNull();
    expect(cleanQuote({ country: "Atlantis", lines: [{ name: "K8" }] })).toBeNull();
    expect(cleanQuote({ country: "Canada", lines: [{ name: "K8" }] })).toBeNull();
    expect(cleanQuote({ lines: [] })).toBeNull();
  });
  it("ignores a base price sent from the browser, and still reads older saved quotes", () => {
    expect(quoteTotal(cleanQuote({ lead: "x", lines: [{ name: "K8", price: 1, tax: 0, shipping: 0 }] })!)).toBe(5480);
    expect(quoteTotal(cleanQuote({ lead: "x", lines: [{ key: "k8", tax: 0, shipping: 0 }] })!)).toBe(5480);
  });
});
