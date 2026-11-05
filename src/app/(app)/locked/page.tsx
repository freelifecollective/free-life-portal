import { notFound } from "next/navigation";
import { Calculator } from "@/components/calculator/Calculator";
import { LeadBoard } from "@/components/tracking/LeadBoard";
import { QuotePicker } from "@/components/quote/QuotePicker";
import { TeamView } from "@/components/tracking/TeamView";
import { DEMO_BOARDS, DEMO_TEAM } from "@/lib/tracking/demo";
import { LockedTeaser } from "@/components/locked/LockedTeaser";
import { requireMember } from "@/lib/auth/guards";
import { LOCKED } from "@/lib/locked";

export const instant = false;
export const metadata = { title: "Members Only" };

export default async function LockedPage(props: PageProps<"/locked">) {
  const sp = await props.searchParams;
  const f = Array.isArray(sp.f) ? sp.f[0] : sp.f;
  await requireMember();
  const page = f ? LOCKED[f] : undefined;
  if (!page) notFound();
  /* where the real page can be drawn without anyone's data, it is: the actual page, just washed out */
  const preview = f === "/calculator" ? <Calculator initialCountry="United States" />
    : f === "/create-quote" ? <QuotePicker initialCountry="United States" />
    : f === "/tracking/leads" ? <LeadBoard initial={DEMO_BOARDS} initialTags={[]} />
    : f === "/tracking/team" ? <TeamView initial={DEMO_TEAM} teamChat={null} />
    : undefined;
  return <LockedTeaser title={page.title} lede={page.lede} kind={page.kind} preview={preview} />;
}
