import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { Calculator } from "@/components/calculator/Calculator";
import { requireMember } from "@/lib/auth/guards";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { defaultCalcCountry } from "@/lib/calculator/default";

export const instant = false;
export const metadata = { title: "Earnings Estimator" };

export default async function CalculatorPage() {
  const { session } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  const lang = (await cookies()).get("flc_lang")?.value;
  const supabase = await createClient();
  const { data: spot } = supabase ? await supabase.from("water_share").select("place").eq("member_id", session.user.id).maybeSingle() : { data: null };
  const country = defaultCalcCountry(spot?.place, lang);
  return (
    <>
      <PageHeading lede="Select your country and amount of points you currently receive to see your commissions">Earnings Estimator</PageHeading>
      <p className="calc-fine">**These are estimates and not a guarantee of the commission you will receive.<br />Commission is dependent on stacking, account status, and how the product is purchased.</p>
      <Calculator initialCountry={country} />
    </>
  );
}
