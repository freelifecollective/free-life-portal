export type HubCall = {
  id: string; member_id: string; lead_name: string; starts_at: string; note: string | null; outcome: "took_place" | "no_show" | null;
  pay_points: number | null; pay_call_cents: number | null; pay_products_cents: number | null; pay_currency: string | null; paid_cents: number; paid_at: string | null;
  products: Record<string, number>;
};
export const owedOf = (c: Pick<HubCall, "pay_call_cents" | "pay_products_cents" | "paid_cents">) => (c.pay_call_cents ?? 0) + (c.pay_products_cents ?? 0) - c.paid_cents;
export const totalOf = (c: Pick<HubCall, "pay_call_cents" | "pay_products_cents">) => (c.pay_call_cents ?? 0) + (c.pay_products_cents ?? 0);
