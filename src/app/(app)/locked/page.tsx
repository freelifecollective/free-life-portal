import { notFound } from "next/navigation";
import { Calculator } from "@/components/calculator/Calculator";
import { LeadBoard } from "@/components/tracking/LeadBoard";
import { QuotePicker } from "@/components/quote/QuotePicker";
import { TeamView } from "@/components/tracking/TeamView";
import { DEMO_BOARDS, DEMO_TEAM } from "@/lib/tracking/demo";
import { LockedTeaser } from "@/components/locked/LockedTeaser";
import { requireMember } from "@/lib/auth/guards";
import { LOCKED } from "@/lib/locked";
import { previewStore } from "@/lib/locked/preview";
import { ResourceGrid } from "@/components/resources/ResourceGrid";

const none = { params: Promise.resolve({}), searchParams: Promise.resolve({}) };
type Page = (p: never) => Promise<React.ReactNode> | React.ReactNode;
/** the real pages, drawn as they are (washed out) for people who do not have them */
const REAL: Record<string, () => Promise<{ default: Page }>> = {
  "/outsourcing": () => import("../outsourcing/page"),
  "/financing": () => import("../financing/page"),
  "/responses": () => import("../responses/page"),
  "/classroom": () => import("../classroom/page"),
  "/business-launch": () => import("../business-launch/page"),
  "/calls": () => import("../calls/page"),
  "/buddy": () => import("../buddy/page"),
  "/graphic-maker": () => import("../graphic-maker/page"),
  "/family-tree": () => import("../family-tree/page"),
  "/tasks": () => import("../tasks/page"),
  "/call-closers": () => import("../call-closers/page"),
  "/facebook-follows": () => import("../facebook-follows/page"),
  "/advertising/evidence-manual": () => import("../advertising/evidence-manual/page"),
  "/advertising/landing-page": () => import("../advertising/landing-page/page"),
  "/tracking/numbers": () => import("../tracking/numbers/page"),
};
const GRIDS: Record<string, [string, "resources" | "advertising"]> = {
  "/resources/books": ["books", "resources"], "/resources/product-information": ["product-information", "resources"],
  "/advertising/pictures-videos": ["pictures-videos", "advertising"], "/advertising/canva-templates": ["canva-templates", "advertising"],
};

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
  let real: React.ReactNode;
  if (!preview && f) {
    previewStore.enterWith(true);
    try {
      if (GRIDS[f]) real = await ResourceGrid({ slug: GRIDS[f][0], section: GRIDS[f][1] });
      else if (REAL[f]) { const mod = await REAL[f](); real = await (mod.default as (p: unknown) => Promise<React.ReactNode>)(none); }
    } catch { real = undefined; /* the outline is shown instead */ }
  }
  return <LockedTeaser title={page.title} lede={page.lede} kind={page.kind} preview={preview ?? real} ownHeading={!preview && !!real} />;
}
