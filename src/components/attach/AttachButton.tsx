"use client";

import { useRef, useState } from "react";
import { ATTACH_ACCEPT, ATTACH_MAX, ATTACH_TYPES, type Attach } from "@/lib/chats/attach";
import { createClient } from "@/lib/supabase/client";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv", "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx", "application/zip": "zip" };

/** A paperclip: choose a picture or a document, it is uploaded, and its details are handed to the chat. */
export function AttachButton({ onPick, disabled = false }: { onPick: (a: Attach) => void | Promise<void>; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    if (!(ATTACH_TYPES as readonly string[]).includes(f.type)) { setError("That kind of file can't be sent. Pictures, PDFs, Office files, text and zip files work."); return; }
    if (f.size > ATTACH_MAX) { setError("That file is over 25 MB."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("not signed in");
      const path = `${sess.session.user.id}/${crypto.randomUUID()}.${EXT[f.type]}`;
      const { error: up } = await supabase.storage.from("chat-files").upload(path, f, { contentType: f.type, cacheControl: "3600" });
      if (up) throw up;
      await onPick({ url: supabase.storage.from("chat-files").getPublicUrl(path).data.publicUrl, name: f.name.slice(0, 160), type: f.type, size: f.size });
    } catch { setError("We could not send that file. Please try again."); }
    setBusy(false);
  }
  return (
    <>
      <input ref={input} type="file" accept={ATTACH_ACCEPT} hidden onChange={choose} />
      <button type="button" className="dock-tool" aria-label="Attach a file" title="Attach a picture or file" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {busy ? <span className="when">…</span> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4L15 7" /></svg>}
      </button>
      {error ? <span className="err vr-err" role="alert">{error}</span> : null}
    </>
  );
}
