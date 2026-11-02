import { describe, expect, it } from "vitest";
import { renderEmail } from "./templates";
import { unsubscribeToken, verifyUnsubscribe } from "./token";

const ctx = { siteUrl: "https://example.com", unsubscribeUrl: "https://example.com/unsubscribe?e=a" };

describe("emails", () => {
  it("writes every step of the series", () => {
    for (const t of ["registration_confirmation", "lead_series_0", "lead_series_1", "lead_series_2", "lead_series_3"]) {
      const m = renderEmail(t, { name: "Sam", title: "Intro call", starts_at: "2026-11-10T00:00:00Z" }, ctx);
      expect(m?.subject, t).toBeTruthy();
      expect(m?.html, t).toContain("Unsubscribe");
      expect(m?.text, t).toContain("Sam");
    }
  });
  it("knows nothing about other templates", () => { expect(renderEmail("nope", {}, ctx)).toBeNull(); });
  it("escapes names", () => {
    const m = renderEmail("lead_series_0", { name: "<script>" }, ctx)!;
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
  it("never mentions the company behind the product", () => {
    for (const t of ["lead_series_0", "lead_series_1", "lead_series_2", "lead_series_3", "registration_confirmation"]) expect(JSON.stringify(renderEmail(t, { name: "x" }, ctx)).toLowerCase()).not.toContain("enagic");
  });
  it("signs unsubscribe links", () => {
    process.env.EMAIL_LINK_SECRET = "test-secret";
    const t = unsubscribeToken("A@B.com");
    expect(verifyUnsubscribe("a@b.com", t)).toBe(true);
    expect(verifyUnsubscribe("other@b.com", t)).toBe(false);
    expect(verifyUnsubscribe("a@b.com", "bad")).toBe(false);
  });
});
