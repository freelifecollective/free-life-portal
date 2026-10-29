import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocFile, DocFolder } from "./types";

const FOLDER = "id, parent_id, name, for_leads, for_downline";
const FILE = "id, folder_id, name, mime, size_bytes, downloadable, for_leads, for_downline, created_at";

/** One folder's contents (null = the top level) plus the path of folders leading to it. Row level security decides what the person may see. */
export async function openFolder(supabase: SupabaseClient, folderId: string | null) {
  const foldersQ = supabase.from("doc_folders").select(FOLDER).order("name");
  const filesQ = supabase.from("doc_files").select(FILE).order("name");
  const [{ data: folders }, { data: files }] = await Promise.all([
    folderId ? foldersQ.eq("parent_id", folderId) : foldersQ.is("parent_id", null),
    folderId ? filesQ.eq("folder_id", folderId) : filesQ.is("folder_id", null),
  ]);
  const trail: DocFolder[] = [];
  let cur = folderId;
  for (let i = 0; cur && i < 15; i++) {
    const { data } = await supabase.from("doc_folders").select(FOLDER).eq("id", cur).maybeSingle();
    if (!data) break;
    trail.unshift(data as DocFolder);
    cur = (data as DocFolder).parent_id;
  }
  return { folders: (folders ?? []) as DocFolder[], files: (files ?? []) as DocFile[], trail, exists: !folderId || trail.some((f) => f.id === folderId) };
}

/** Every folder, for the "Move to…" list (admins). */
export async function allFolders(supabase: SupabaseClient): Promise<DocFolder[]> {
  const { data } = await supabase.from("doc_folders").select(FOLDER).order("name").limit(2000);
  return (data ?? []) as DocFolder[];
}
