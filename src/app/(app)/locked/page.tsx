import { notFound } from "next/navigation";
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
  return <LockedTeaser title={page.title} lede={page.lede} kind={page.kind} />;
}
