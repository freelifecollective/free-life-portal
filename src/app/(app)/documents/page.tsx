import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { DocBrowser } from "@/components/documents/DocBrowser";
import { requireMember } from "@/lib/auth/guards";
import { openFolder } from "@/lib/documents/queries";

export const instant = false;
export const metadata = { title: "Documents" };

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.f) ? sp.f[0] : sp.f;
  const folderId = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Documents</PageHeading><p className="page-lede">This needs the database.</p></>;
  const view = await openFolder(supabase, folderId);
  if (folderId && !view.exists) notFound();
  return (
    <>
      <PageHeading lede="Guides, scripts and resources for the community.">Documents</PageHeading>
      <DocBrowser key={folderId ?? "top"} folderId={folderId} trail={view.trail} folders={view.folders} files={view.files} thumbUrls={view.thumbUrls} allFolders={[]} manage={false} basePath="/documents" role={session.profile.role} />
    </>
  );
}
