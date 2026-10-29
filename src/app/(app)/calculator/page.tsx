import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { Calculator } from "@/components/calculator/Calculator";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Earnings Estimator" };

export default async function CalculatorPage() {
  const { session } = await requireMember();
  if (session.profile.role === "lead") redirect("/");
  return (
    <>
      <PageHeading lede="Select your country and amount of points you currently receive to see your commissions">Earnings Estimator</PageHeading>
      <p className="calc-fine">**These are estimates and not a guarantee of the commission you will receive.<br />Commission is dependent on stacking, account status, and how the product is purchased.</p>
      <Calculator />
    </>
  );
}
