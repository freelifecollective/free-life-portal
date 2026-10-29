"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireMember } from "@/lib/auth/guards";
import { isViewable, MAX_FILE_BYTES } from "@/lib/documents/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result = { ok: boolean; error?: string };
type IdResult = { ok: boolean; error?: string; id?: string };
const refresh = () => { revalidatePath("/documents"); revalidatePath("/admin/documents"); };
const cleanName = (s: unknown, max: number) => String(s ?? "").trim().replace(/[\\/]+/g, "-").slice(0, max);
const parentOk = (p: string | null) => p === null || UUID.test(p);

/** Finds a folder by name in a place, or makes it. Used by "New folder" and by the zip import. */
export async function ensureFolder(parentId: string | null, name: string): Promise<IdResult> {
  const n = cleanName(name, 120);
  if (!n || !parentOk(parentId)) return { ok: false, error: "Give the folder a name." };
  const { session, supabase } = await requireAdmin();
  const q = supabase.from("doc_folders").select("id").ilike("name", n.replace(/[%_]/g, (c) => `\\${c}`));
  const { data: found } = await (parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null)).limit(1);
  if (found?.[0]) return { ok: true, id: found[0].id };
  const { data, error } = await supabase.from("doc_folders").insert({ name: n, parent_id: parentId, created_by: session.user.id }).select("id").single();
  if (error) return { ok: false, error: error.message.includes("deep") ? "Folders are nested too deep." : "We could not create that folder." };
  refresh();
  return { ok: true, id: data.id };
}

export async function registerFile(input: { folderId: string | null; path: string; name: string; mime: string; size: number; thumbPath?: string | null }): Promise<Result & { id?: string }> {
  const { session, supabase } = await requireAdmin();
  const name = cleanName(input.name, 200);
  if (!name || !parentOk(input.folderId) || !input.path || input.path.includes("..") || input.size > MAX_FILE_BYTES) return { ok: false, error: "That file could not be added." };
  const { data, error } = await supabase.from("doc_files").insert({ folder_id: input.folderId, name, storage_path: input.path, thumb_path: input.thumbPath && !input.thumbPath.includes("..") ? input.thumbPath : null, mime: input.mime || "application/octet-stream", size_bytes: Math.max(0, Math.floor(input.size)), created_by: session.user.id }).select("id").single();
  if (error) return { ok: false, error: "We could not save that file." };
  refresh();
  return { ok: true, id: data.id };
}

export async function renameItem(kind: "folder" | "file", id: string, name: string): Promise<Result> {
  const n = cleanName(name, kind === "folder" ? 120 : 200);
  if (!UUID.test(id) || !n) return { ok: false, error: "Enter a name." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from(kind === "folder" ? "doc_folders" : "doc_files").update({ name: n }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "Something with that name is already here." : "We could not rename that." };
  refresh();
  return { ok: true };
}

export async function moveItem(kind: "folder" | "file", id: string, to: string | null): Promise<Result> {
  if (!UUID.test(id) || !parentOk(to)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from(kind === "folder" ? "doc_folders" : "doc_files").update(kind === "folder" ? { parent_id: to } : { folder_id: to }).eq("id", id);
  if (error) return { ok: false, error: error.code === "23514" ? "A folder cannot go inside itself or be nested that deep." : error.code === "23505" ? "Something with that name is already there." : "We could not move that." };
  refresh();
  return { ok: true };
}

export async function setFolderAccess(id: string, leads: boolean, downline: boolean, cascade: boolean): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("set_doc_visibility", { p_folder: id, p_leads: leads, p_downline: downline, p_cascade: cascade });
  if (error) return { ok: false, error: "We could not save that." };
  refresh();
  return { ok: true };
}

export async function setFileAccess(id: string, leads: boolean, downline: boolean, downloadable: boolean): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { data: f } = await supabase.from("doc_files").select("mime").eq("id", id).maybeSingle();
  if (!f) return { ok: false, error: "That document was not found." };
  if (!downloadable && !isViewable(f.mime)) return { ok: false, error: "Only PDFs, pictures, videos, audio and text files can be view-only. Other types need to be downloadable." };
  const { error } = await supabase.from("doc_files").update({ for_leads: leads, for_downline: downline, downloadable }).eq("id", id);
  if (error) return { ok: false, error: "We could not save that." };
  refresh();
  return { ok: true };
}

export async function deleteItem(kind: "folder" | "file", id: string): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  // collect the stored files first, so nothing is left behind in storage
  let ids: string[] = [id];
  const paths: string[] = [];
  if (kind === "folder") {
    const all: string[] = [id];
    for (let frontier = [id], i = 0; frontier.length && i < 15; i++) {
      const { data } = await supabase.from("doc_folders").select("id").in("parent_id", frontier);
      frontier = (data ?? []).map((d) => d.id);
      all.push(...frontier);
    }
    ids = all;
    const { data: files } = await supabase.from("doc_files").select("storage_path, thumb_path").in("folder_id", ids).limit(5000);
    for (const f of files ?? []) { paths.push(f.storage_path); if (f.thumb_path) paths.push(f.thumb_path); }
  } else {
    const { data } = await supabase.from("doc_files").select("storage_path, thumb_path").eq("id", id).maybeSingle();
    if (data) { paths.push(data.storage_path); if (data.thumb_path) paths.push(data.thumb_path); }
  }
  const { error } = await supabase.from(kind === "folder" ? "doc_folders" : "doc_files").delete().eq("id", id);
  if (error) return { ok: false, error: "We could not delete that." };
  for (let i = 0; i < paths.length; i += 100) await supabase.storage.from("documents").remove(paths.slice(i, i + 100));
  refresh();
  return { ok: true };
}

/** Short-lived links for one document the person is allowed to see. A view-only document never gets a download link. */
export async function getFileLinks(id: string): Promise<{ ok: boolean; error?: string; view?: string; download?: string; mime?: string; name?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireMember();
  if (!supabase) return { ok: false, error: "Needs the database." };
  const { data: f } = await supabase.from("doc_files").select("name, mime, storage_path, downloadable").eq("id", id).maybeSingle();
  if (!f) return { ok: false, error: "That document is not available." };
  const bucket = supabase.storage.from("documents");
  const [view, dl] = await Promise.all([
    isViewable(f.mime) ? bucket.createSignedUrl(f.storage_path, 300) : Promise.resolve({ data: null }),
    f.downloadable ? bucket.createSignedUrl(f.storage_path, 120, { download: f.name }) : Promise.resolve({ data: null }),
  ]);
  return { ok: true, view: view.data?.signedUrl, download: dl.data?.signedUrl, mime: f.mime, name: f.name };
}

/** Attach a preview picture to a document that was added before previews existed. */
export async function setThumb(id: string, thumbPath: string): Promise<Result> {
  if (!UUID.test(id) || !thumbPath || thumbPath.includes("..")) return { ok: false, error: "Something went wrong." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("doc_files").update({ thumb_path: thumbPath }).eq("id", id);
  if (error) return { ok: false, error: "We could not save that." };
  refresh();
  return { ok: true };
}

/** For a document that was added before previews existed: a short-lived link so the admin's browser can build one. */
export async function getSourceLink(id: string): Promise<{ ok: boolean; url?: string }> {
  if (!UUID.test(id)) return { ok: false };
  const { supabase } = await requireAdmin();
  const { data: f } = await supabase.from("doc_files").select("storage_path").eq("id", id).maybeSingle();
  if (!f) return { ok: false };
  const { data } = await supabase.storage.from("documents").createSignedUrl(f.storage_path, 120);
  return { ok: !!data?.signedUrl, url: data?.signedUrl };
}
