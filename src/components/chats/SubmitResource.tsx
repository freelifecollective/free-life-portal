"use client";

import { useRef, useState } from "react";
import { submitResource } from "@/app/(app)/chats/resource-actions";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "confirm" | "thanks";
const MAX_FILES = 5, MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp";
const STATUS: Record<string, string> = { pending: "Waiting for review", accepted: "Accepted", declined: "Declined" };

export function SubmitResource({ userId, name, avatarUrl, initials, mine }: {
  userId: string; name: string; avatarUrl: string | null; initials: string;
  mine: { id: string; title: string; status: string }[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("form");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function open() { setStep("form"); setError(""); dialog.current?.showModal(); }
  function close() { dialog.current?.close(); }

  function toConfirm(e: React.FormEvent) {
    e.preventDefault();
    const list = links.split(/\s+/).filter(Boolean);
    if (list.some((l) => !/^https:\/\/\S+$/.test(l))) return setError("Links must start with https:// (one per line).");
    if (list.length > 5) return setError("Please add up to 5 links.");
    setError(""); setStep("confirm");
  }

  async function send() {
    setBusy(true); setError("");
    try {
      const supabase = createClient();
      const uploaded: { path: string; name: string; size: number }[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
        const path = `${userId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("resource-submissions").upload(path, f, { contentType: f.type || undefined });
        if (upErr) throw new Error(`We could not upload ${f.name}. Check the file type and size.`);
        uploaded.push({ path, name: f.name, size: f.size });
      }
      const r = await submitResource({ title, description, links: links.split(/\s+/).filter(Boolean), files: uploaded });
      if (!r.ok) throw new Error(r.error ?? "That did not work.");
      setStep("thanks"); setTitle(""); setDescription(""); setLinks(""); setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work."); setStep("form");
    } finally { setBusy(false); }
  }

  function pick(list: FileList | null) {
    const next = [...files, ...Array.from(list ?? [])];
    if (next.length > MAX_FILES) return setError(`Up to ${MAX_FILES} files.`);
    if (next.some((f) => f.size > MAX_BYTES)) return setError("Each file must be under 25 MB.");
    setError(""); setFiles(next);
  }

  return (
    <div>
      <button type="button" className="btn primary" onClick={open}>Submit Your Resources Here</button>
      {mine.length ? (
        <ul className="rs-mine" aria-label="Your submissions">
          {mine.map((m) => <li key={m.id}><span>{m.title}</span><span className={"rs-status " + m.status}>{STATUS[m.status] ?? m.status}</span></li>)}
        </ul>
      ) : null}
      <dialog ref={dialog} className="rs-dialog" aria-labelledby="rs-title">
        {step === "form" ? (
          <form onSubmit={toConfirm}>
            <h2 id="rs-title" className="qh" style={{ marginTop: 0 }}>Submit a resource</h2>
            <div className="who" style={{ marginBottom: 14 }}><Avatar url={avatarUrl} initials={initials} size={44} /><strong>{name}</strong></div>
            <div className="field"><label htmlFor="rs-t">Title</label><input id="rs-t" type="text" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field" style={{ marginTop: 12 }}><label htmlFor="rs-d">Description</label><textarea id="rs-d" required rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="rs-f">Upload documents (optional)</label>
              <input id="rs-f" type="file" multiple accept={ACCEPT} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              {files.length ? <ul className="rs-items">{files.map((f, i) => <li key={i}>{f.name} <button type="button" className="linkbtn" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button></li>)}</ul> : null}
            </div>
            <div className="field" style={{ marginTop: 12 }}><label htmlFor="rs-l">Links (optional, one per line)</label><textarea id="rs-l" rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://" /></div>
            <p className="err" role="alert">{error}</p>
            <div className="dlg-actions"><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn primary">Submit</button></div>
          </form>
        ) : step === "confirm" ? (
          <div>
            <h2 id="rs-title" className="qh" style={{ marginTop: 0 }}>Before you submit</h2>
            <p>Thank you for helping to contribute to our resources! Each contribution is truly what makes us a community. If your resource is accepted and loaded into the system, it will become property of FLC and anyone can use and share it. Please confirm you would like to move forward and submit your resource by hitting Submit below.</p>
            <p className="err" role="alert">{error}</p>
            <div className="dlg-actions"><button type="button" className="btn" disabled={busy} onClick={() => setStep("form")}>Back</button><button type="button" className="btn primary" disabled={busy} onClick={send}>{busy ? "Sending…" : "Submit"}</button></div>
          </div>
        ) : (
          <div>
            <h2 id="rs-title" className="qh" style={{ marginTop: 0 }}>Thank you!</h2>
            <p>Thank you for your submission, we will notify you once it is approved or declined.</p>
            <div className="dlg-actions"><button type="button" className="btn primary" onClick={close}>Close</button></div>
          </div>
        )}
      </dialog>
    </div>
  );
}
