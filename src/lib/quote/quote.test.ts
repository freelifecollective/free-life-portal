import { describe, expect, it } from "vitest";
import { cleanQuote, earnFor, expandSelection, quoteTitle, quoteTotal } from "./model";

describe("quote", () => {
  it("expands packages into their products", () => {
    expect(expandSelection({ "Quad (Anespa, K8 x2, Ukon Σ)": 1 })).toEqual(["anespa", "k8", "k8", "ukon"]);
    expect(expandSelection({ K8: 2 })).toEqual(["k8", "k8"]);
    expect(expandSelection({ "SD501U": 1 })).toBeNull();
    expect(expandSelection({})).toBeNull();
  });
  it("adds base price, tax and shipping", () => {
    const d = cleanQuote({ lead: "  Ana ", lang: "es", lines: [{ key: "k8", tax: 100, shipping: "50.5" }, { key: "ukon", tax: 0, shipping: 0 }] })!;
    expect(d.lead).toBe("Ana");
    expect(quoteTotal(d)).toBe(5480 + 100 + 50.5 + 2580);
    expect(earnFor(d)).toBe(115);
    expect(quoteTitle(d)).toBe("EL K8 + UKON DE ANA");
  });
  it("refuses anything that is not a known product", () => {
    expect(cleanQuote({ lines: [{ key: "evil", tax: 1, shipping: 1 }] })).toBeNull();
    expect(cleanQuote({ lines: [] })).toBeNull();
  });
  it("ignores a base price sent from the browser", () => {
    const d = cleanQuote({ lead: "x", lines: [{ key: "k8", price: 1, tax: 0, shipping: 0 }] })!;
    expect(quoteTotal(d)).toBe(5480);
  });
});
