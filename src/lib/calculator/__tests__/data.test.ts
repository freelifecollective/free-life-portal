import { describe, expect, it } from "vitest";
import { COMMISSIONS } from "../data";

describe("commission data", () => {
  it("starts on the United States and has all six countries", () => {
    expect(COMMISSIONS.default).toBe("United States");
    expect(COMMISSIONS.countries.map((c) => c.name).sort()).toEqual(["Australia", "Canada", "Europe", "Mexico", "New Zealand", "United States"]);
  });
  it("keeps the spreadsheet numbers", () => {
    const us = COMMISSIONS.countries.find((c) => c.name === "United States")!;
    expect(us.products.find((p) => p.name === "K8")!.rates["1"]).toBe(351);
    expect(us.products.find((p) => p.name === "Anespa")!.rates["8"]).toBe(1560);
  });
  it("has a rate for every product at every point level", () => {
    for (const c of COMMISSIONS.countries) for (const p of c.products) for (let n = 1; n <= 8; n++) expect(p.rates[String(n)], `${c.name} ${p.name} ${n}`).toBeGreaterThan(0);
  });
});
