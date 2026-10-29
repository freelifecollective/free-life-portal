import { describe, expect, it } from "vitest";
import { buildReceiptsPdf, formatMoney, type Payment } from "../receipt";

const pay = (n: number): Payment => ({ id: String(n), receipt_no: n, amount_cents: 9700, currency: "usd", description: "Monthly membership", status: "paid", paid_at: "2026-02-05T15:00:00Z" });

describe("receipts", () => {
  it("formats money", () => expect(formatMoney(9700)).toBe("$97.00"));
  it("makes a real PDF with one page per receipt", async () => {
    const bytes = await buildReceiptsPdf([pay(1), pay(2), pay(3)], { name: "Zoë O'Brien", email: "z@example.com" });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  });
  it("handles an empty list without crashing", async () => {
    expect((await buildReceiptsPdf([], { name: "A", email: "a@b.c" })).length).toBeGreaterThan(100);
  });
});
