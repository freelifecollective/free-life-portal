import { notFound } from "next/navigation";
import { QuoteCard } from "@/components/quote/QuoteCard";
import { cleanQuote } from "@/lib/quote/model";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your quote", robots: { index: false, follow: false } };
export const instant = false;

/** What a lead sees when they open the link they were sent. Anyone with the link can see this one quote and nothing else. */
export default async function QuotePage(props: PageProps<"/q/[token]">) {
  const { token } = await props.params;
  if (!/^[0-9a-f]{20,64}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_quote", { p_token: token });
  const quote = cleanQuote(data);
  if (!quote) notFound();
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px 16px", background: "var(--bg)" }}>
      <QuoteCard data={quote} />
    </main>
  );
}
