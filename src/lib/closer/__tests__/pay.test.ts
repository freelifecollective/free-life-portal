import { describe, expect, it } from "vitest";
import { computePay, money, pointsOfRank, type PayRule } from "../pay";

const rules: PayRule[] = [{ rank_from: 1, rank_to: 3, kind: "flat", amount: 5000 }, { rank_from: 4, rank_to: 7, kind: "percent", amount: 8 }];
const base = { country: "United States", points: 1, rankId: 2, products: {}, callCents: 5000, tookPlace: true, rules };

describe("what a closer is owed", () => {
  it("is the call price alone when no products were bought", () => {
    expect(computePay(base)).toMatchObject({ callCents: 5000, productCents: 0, totalCents: 5000 });
  });
  it("is the call price plus $50 per product for a 1A-3A affiliate", () => {
    const r = computePay({ ...base, rankId: 3, points: 3, products: { K8: 2, Anespa: 1 } });
    expect(r.units).toBe(3);
    expect(r.productCents).toBe(15000);
    expect(r.totalCents).toBe(20000);
  });
  it("is the call price plus 8% of the total commission for a 4A-6A+ affiliate", () => {
    const r = computePay({ ...base, rankId: 5, points: 5, products: { K8: 1 } });
    expect(r.commissionCents).toBe(175500);
    expect(r.productCents).toBe(14040);
    expect(r.totalCents).toBe(19040);
  });
  it("uses the rule for the affiliate's own rank", () => {
    expect(computePay({ ...base, rankId: 3, products: { K8: 1 } }).rule?.kind).toBe("flat");
    expect(computePay({ ...base, rankId: 4, points: 4, products: { K8: 1 } }).rule?.kind).toBe("percent");
    expect(computePay({ ...base, rankId: 7, points: 7, products: { K8: 1 } }).rule?.kind).toBe("percent");
  });
  it("is nothing when the call did not take place", () => {
    expect(computePay({ ...base, tookPlace: false, products: { K8: 1 } }).totalCents).toBe(0);
  });
  it("is only the call price when the closer has no rule for that rank", () => {
    expect(computePay({ ...base, rankId: 6, points: 6, rules: [rules[0]], products: { K8: 1 } })).toMatchObject({ productCents: 0, totalCents: 5000 });
    expect(computePay({ ...base, rankId: null, products: { K8: 1 } }).productCents).toBe(0);
  });
  it("uses the table and currency of the affiliate's country", () => {
    expect(computePay({ ...base, country: "Europe", rankId: 5, points: 5, products: { K8: 1 } }).currency).toBe("EUR");
  });
  it("ignores products that are not in the list and limits silly quantities", () => {
    expect(computePay({ ...base, products: { Nope: 4, K8: 500 } }).units).toBe(99);
  });
  it("turns a rank into estimator points", () => {
    expect([pointsOfRank(1), pointsOfRank(6), pointsOfRank(7), pointsOfRank(null)]).toEqual([1, 6, 7, 1]);
    expect(money(19040, "USD")).toBe("$190.40");
  });
});
