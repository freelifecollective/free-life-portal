import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { DocBrowser } from "@/components/documents/DocBrowser";
import { requireAdmin } from "@/lib/auth/guards";
import { FolderPlacement } from "@/components/admin/FolderPlacement";
import { allFolders, openFolder } from "@/lib/documents/queries";
import { placementLabel } from "@/lib/documents/placements";

export const instant = false;
export const metadata = { title: "Manage Documents" };

export default async function UpdateDocumentsPage(props: PageProps<"/admin/documents">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.f) ? sp.f[0] : sp.f;
  const folderId = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const { session, supabase } = await requireAdmin();
  const [view, folders] = await Promise.all([openFolder(supabase, folderId), allFolders(supabase)]);
  if (folderId && !view.exists) notFound();
  const { data: placed } = await supabase.from("doc_folders").select("id, name, parent_id, placement").limit(2000);
  const rows = (placed ?? []) as { id: string; name: string; parent_id: string | null; placement: string | null }[];
  const here = folderId ? rows.find((r) => r.id === folderId) : null;
  const unplaced = rows.filter((r) => !r.parent_id && !r.placement);
  return (
    <>
      <PageHeading lede="Add, organize and choose who can see documents. Open a folder to choose which page its documents show on. Changes show straight away.">Manage Documents</PageHeading>
      {here ? <FolderPlacement key={here.id + (here.placement ?? "")} folderId={here.id} name={here.name} current={here.placement ?? ""} /> : (
        <p className="when" style={{ margin: "0 0 12px" }}>
          {rows.filter((r) => r.placement).length ? `On pages already: ${rows.filter((r) => r.placement).map((r) => `${r.name} → ${placementLabel(r.placement)}`).join(", ")}. ` : ""}
          {unplaced.length ? `Not on any page yet: ${unplaced.map((r) => r.name).join(", ")}. Open a folder to choose where it shows.` : "Open a folder to choose which page its documents show on."}
        </p>
      )}
      <DocBrowser key={folderId ?? "top"} folderId={folderId} trail={view.trail} folders={view.folders} files={view.files} thumbUrls={view.thumbUrls} allFolders={folders} manage basePath="/admin/documents" role={session.profile.role} />
    </>
  );
}
