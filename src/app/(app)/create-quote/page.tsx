import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { QuoteHistory, type PastQuote } from "@/components/quote/QuoteHistory";
import { QuotePicker } from "@/components/quote/QuotePicker";
import { cleanQuote, moneyIn, quoteTitle, quoteTotal } from "@/lib/quote/model";
import { cookies } from "next/headers";
import { defaultCalcCountry } from "@/lib/calculator/default";
import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Create a Quote" };

export default async function CreateQuotePage(props: PageProps<"/create-quote">) {
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  const lang = (await cookies()).get("flc_lang")?.value;
  const [{ data: spot }, { data: me }] = supabase ? await Promise.all([
    supabase.from("water_share").select("place").eq("member_id", session.user.id).maybeSingle(),
    supabase.from("profiles").select("country").eq("id", session.user.id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const country = defaultCalcCountry(spot?.place, lang, "United States", me?.country);
  const { data: rows } = supabase ? await supabase.from("quotes").select("token, data, lead_email, sent_at, followup_done, nudges").eq("user_id", session.user.id).order("sent_at", { ascending: false }).limit(200) : { data: null };
  const past: PastQuote[] = [];
  for (const r of (rows ?? []) as { token: string; data: unknown; lead_email: string | null; sent_at: string; followup_done: boolean }[]) {
    const d = cleanQuote(r.data);
    if (!d) continue;
    past.push({ token: r.token, lead: d.lead, title: quoteTitle(d), total: moneyIn(d, quoteTotal(d), true), sentAt: r.sent_at, email: r.lead_email, done: r.followup_done });
  }
  return (
    <>
      <PageHeading lede="Choose the products, add your lead's name, tax and shipping, and send them a quote they can keep or share.">Create a Quote</PageHeading>
      <PlacedDocs placement="quote" />
      <QuoteHistory quotes={past} startOpen={sp.quotes === "1"} />
      <QuotePicker initialCountry={country} />
    </>
  );
}
