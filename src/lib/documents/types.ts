export type DocFolder = { id: string; parent_id: string | null; name: string; for_leads: boolean; for_downline: boolean };
export type DocFile = { id: string; folder_id: string | null; name: string; mime: string; size_bytes: number; downloadable: boolean; for_leads: boolean; for_downline: boolean; created_at: string; thumb_path: string | null };

/** The biggest file that can be uploaded, in MB. 50 is the limit of the free Supabase plan; raise it with NEXT_PUBLIC_MAX_UPLOAD_MB after upgrading (and raise the storage limits too). */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 50;
export const MAX_FILE_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const MIME: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  txt: "text/plain", csv: "text/csv", md: "text/plain", zip: "application/zip",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const mimeFor = (name: string): string => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
/** Can a browser show this itself? Only these can be made view-only. */
export const isViewable = (mime: string): boolean => /^(application\/pdf|image\/|video\/|audio\/|text\/plain)/.test(mime);
/** Word, Excel and PowerPoint files: not shown by the browser itself, but Microsoft's free viewer can show them. */
export const isOfficeDoc = (mime: string): boolean => /^application\/(msword|vnd\.ms-(excel|powerpoint)|vnd\.openxmlformats-officedocument\.)/.test(mime);
/** Everything that can be previewed inside the portal (view-only can still only be switched on for the first kind, isViewable). */
export const isPreviewable = (mime: string): boolean => isViewable(mime) || isOfficeDoc(mime) || mime === "text/csv";
export const sizeLabel = (n: number): string => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const safeName = (name: string): string => name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-100) || "file";
