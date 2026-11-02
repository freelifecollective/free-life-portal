import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.EMAIL_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** A signature that goes in an unsubscribe link, so nobody can unsubscribe someone else's address. */
export function unsubscribeToken(email: string): string {
  return createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("hex").slice(0, 40);
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  if (!secret() || !email || !token) return false;
  const want = Buffer.from(unsubscribeToken(email));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}
