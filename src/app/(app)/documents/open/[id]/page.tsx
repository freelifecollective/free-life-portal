import Link from "next/link";
import { notFound } from "next/navigation";
import { getFileLinks } from "@/app/(app)/documents/actions";
import { PageHeading } from "@/components/PageHeading";
import { OpenedDoc } from "@/components/documents/OpenedDoc";
import { requireMember } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Document" };

/** A document opened directly (from Weekly Focus), without going to its folder. */
export default async function OpenDocPage(props: PageProps<"/documents/open/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireMember();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getFileLinks(id);
  if (!r.ok) notFound();
  return (
    <>
      <p style={{ margin: "0 0 8px" }}><Link className="doc-back" href="/support">← Back to Weekly Focus</Link></p>
      <PageHeading><span translate="no">{r.name}</span></PageHeading>
      <OpenedDoc name={r.name ?? "Document"} mime={r.mime ?? ""} view={r.view} download={r.download} />
    </>
  );
}
