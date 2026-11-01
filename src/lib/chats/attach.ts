/** Files people can send in a chat: pictures and common documents, up to 25 MB. */
export const ATTACH_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip",
] as const;
export const ATTACH_MAX = 25 * 1024 * 1024;
export const ATTACH_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip," + ATTACH_TYPES.join(",");
export type Attach = { url: string; name: string; type: string; size: number };

export const ATTACH_URL = /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/(chat-files|dm-pictures)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;
export const VOICE_URL = /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/voice-notes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|m4a|ogg)$/i;
export const VOICE_MAX_SECS = 900;

export function validAttach(a: Attach | null | undefined): a is Attach {
  return !!a && ATTACH_URL.test(a.url) && (ATTACH_TYPES as readonly string[]).includes(a.type) && a.name.length >= 1 && a.name.length <= 160 && a.size >= 1 && a.size <= ATTACH_MAX;
}
export const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const isImage = (type: string) => type.startsWith("image/");
