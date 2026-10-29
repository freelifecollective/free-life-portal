import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { DocBrowser } from "@/components/documents/DocBrowser";
import { requireAdmin } from "@/lib/auth/guards";
import { allFolders, openFolder } from "@/lib/documents/queries";

export const instant = false;
export const metadata = { title: "Update Documents" };

export default async function UpdateDocumentsPage(props: PageProps<"/admin/documents">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.f) ? sp.f[0] : sp.f;
  const folderId = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const { session, supabase } = await requireAdmin();
  const [view, folders] = await Promise.all([openFolder(supabase, folderId), allFolders(supabase)]);
  if (folderId && !view.exists) notFound();
  return (
    <>
      <PageHeading lede="Add, organize and choose who can see documents. Changes show on the Documents tab straight away.">Update Documents</PageHeading>
      <DocBrowser key={folderId ?? "top"} folderId={folderId} trail={view.trail} folders={view.folders} files={view.files} thumbUrls={view.thumbUrls} allFolders={folders} manage basePath="/admin/documents" role={session.profile.role} />
    </>
  );
}
