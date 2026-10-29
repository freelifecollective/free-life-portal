import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatInZone } from "@/lib/time";

export type Payment = {
  id: string; receipt_no: number; amount_cents: number; currency: string;
  description: string; status: "paid" | "refunded"; paid_at: string;
};

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** pdf-lib's built-in fonts only cover basic Latin, so anything else becomes "?". */
const latin = (s: string) => s.replace(/[^\x20-\x7E]/g, "?");

/** One receipt per page, in the order given. */
export async function buildReceiptsPdf(payments: Payment[], who: { name: string; email: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.17, 0.145, 0.133), muted = rgb(0.46, 0.416, 0.392), brown = rgb(0.671, 0.565, 0.502);

  for (const p of payments) {
    const page = pdf.addPage([612, 792]);
    let y = 700;
    page.drawText("Free Life Collective", { x: 56, y, size: 26, font: serif, color: ink });
    y -= 22;
    page.drawText("Receipt", { x: 56, y, size: 13, font: sans, color: muted });
    page.drawLine({ start: { x: 56, y: y - 16 }, end: { x: 556, y: y - 16 }, thickness: 2, color: brown });
    y -= 56;
    const row = (label: string, value: string) => {
      page.drawText(label.toUpperCase(), { x: 56, y, size: 9, font: bold, color: muted });
      page.drawText(latin(value), { x: 200, y, size: 12, font: sans, color: ink });
      y -= 30;
    };
    row("Receipt number", `FLC-${String(p.receipt_no).padStart(6, "0")}`);
    row("Date paid", formatInZone(new Date(p.paid_at)));
    row("Billed to", who.name);
    row("Email", who.email);
    row("Description", p.description);
    row("Status", p.status === "paid" ? "Paid" : "Refunded");
    y -= 10;
    page.drawLine({ start: { x: 56, y }, end: { x: 556, y }, thickness: 0.5, color: muted });
    y -= 34;
    page.drawText("TOTAL", { x: 56, y, size: 10, font: bold, color: muted });
    page.drawText(formatMoney(p.amount_cents, p.currency), { x: 200, y: y - 2, size: 20, font: bold, color: ink });
    page.drawText("Thank you for being part of the Free Life Collective.", { x: 56, y: 70, size: 10, font: sans, color: muted });
  }
  return pdf.save();
}
