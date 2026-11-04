import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { QuotePicker } from "@/components/quote/QuotePicker";
import { cookies } from "next/headers";
import { defaultCalcCountry } from "@/lib/calculator/default";
import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";

export const instant = false;
export const metadata = { title: "Create a Quote" };

export default async function CreateQuotePage() {
  const { session, supabase } = await requireMember();
  if (!isAffiliate(session.profile.role)) redirect("/");
  const lang = (await cookies()).get("flc_lang")?.value;
  const [{ data: spot }, { data: me }] = supabase ? await Promise.all([
    supabase.from("water_share").select("place").eq("member_id", session.user.id).maybeSingle(),
    supabase.from("profiles").select("country").eq("id", session.user.id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const country = defaultCalcCountry(spot?.place, lang, "United States", me?.country);
  return (
    <>
      <PageHeading lede="Choose the products, add your lead's name, tax and shipping, and send them a quote they can keep or share.">Create a Quote</PageHeading>
      <PlacedDocs placement="quote" />
      <QuotePicker initialCountry={country} />
    </>
  );
}
