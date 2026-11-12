"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyDefaultMessage, deleteMessage, saveMessage } from "@/app/(app)/advertising/funnels/messages-actions";
import type { DefaultMessage } from "@/lib/messages/defaults";

export type Msg = { id: string; kind: "email" | "text"; name: string; subject: string | null; body: string; default_key: string | null };

function Editor({ m, onDone }: { m: Partial<Msg> & { kind: "email" | "text" }; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(m.name ?? "");
  const [subject, setSubject] = useState(m.subject ?? "");
  const [body, setBody] = useState(m.body ?? "");
  const [err, setErr] = useState("");
  return (
    <form className="mv-editor" onSubmit={(e) => { e.preventDefault(); setErr(""); start(async () => { const r = await saveMessage({ id: m.id, kind: m.kind, name, subject, body }); if (r.ok) { onDone(); router.refresh(); } else setErr(r.error ?? "Something went wrong."); }); }}>
      <div className="field"><label htmlFor={`mv-n-${m.id ?? "new"}`}>Name (only you see this)</label><input id={`mv-n-${m.id ?? "new"}`} type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
      {m.kind === "email" ? <div className="field"><label htmlFor={`mv-s-${m.id ?? "new"}`}>Subject line</label><input id={`mv-s-${m.id ?? "new"}`} type="text" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></div> : null}
      <div className="field"><label htmlFor={`mv-b-${m.id ?? "new"}`}>{m.kind === "email" ? "Email" : "Text message"}</label>
        <textarea id={`mv-b-${m.id ?? "new"}`} rows={m.kind === "email" ? 10 : 4} maxLength={m.kind === "text" ? 640 : 10000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <p className="when" style={{ margin: 0 }}>Write {"{first_name}"} and it becomes each person&apos;s first name.{m.kind === "text" ? ` ${body.length}/640 characters.` : " Leave an empty line between paragraphs."}</p>
      <div className="mv-actions">
        <button type="submit" className="btn primary small" disabled={pending}>Save</button>
        <button type="button" className="linkbtn" onClick={onDone}>Cancel</button>
      </div>
      {err ? <p className="status bad" role="alert">{err}</p> : null}
    </form>
  );
}

/** The member's emails and texts, the ready-made ones they can start from, and a way to write new ones. */
export function MessagesView({ messages, defaults }: { messages: Msg[]; defaults: DefaultMessage[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"email" | "text">("email");
  const [open, setOpen] = useState<string | null>(null);
  const mine = messages.filter((m) => m.kind === kind);
  const used = new Set(messages.map((m) => m.default_key).filter(Boolean));
  const ready = defaults.filter((d) => d.kind === kind && !used.has(d.key));
  return (
    <div className="mv">
      <div className="mv-kinds" role="tablist" aria-label="Emails or texts">
        <button type="button" role="tab" aria-selected={kind === "email"} className={kind === "email" ? "on" : ""} onClick={() => { setKind("email"); setOpen(null); }}>Emails</button>
        <button type="button" role="tab" aria-selected={kind === "text"} className={kind === "text" ? "on" : ""} onClick={() => { setKind("text"); setOpen(null); }}>Texts</button>
      </div>

      <section className="mv-section">
        <div className="mv-head"><h2 className="qh">{kind === "email" ? "Your emails" : "Your texts"}</h2>
          {open !== "new" ? <button type="button" className="btn small" onClick={() => setOpen("new")}>{kind === "email" ? "+ Write an email" : "+ Write a text"}</button> : null}
        </div>
        {open === "new" ? <Editor m={{ kind }} onDone={() => setOpen(null)} /> : null}
        {mine.length === 0 && open !== "new" ? <p className="when">Nothing here yet. Start from a ready-made one below, or write your own.</p> : null}
        <ul className="mv-list">
          {mine.map((m) => (
            <li key={m.id} className="mv-item">
              {open === m.id ? <Editor m={{ ...m }} onDone={() => setOpen(null)} /> : (
                <>
                  <div className="mv-text"><b translate="no">{m.name}</b>{m.subject ? <span translate="no">{m.subject}</span> : null}<p translate="no">{m.body}</p></div>
                  <div className="mv-actions">
                    <button type="button" className="btn small" onClick={() => setOpen(m.id)}>Edit</button>
                    <button type="button" className="linkbtn danger" disabled={pending} onClick={() => { if (window.confirm(`Delete "${m.name}"? Automations that use it will skip it.`)) start(async () => { await deleteMessage(m.id); router.refresh(); }); }}>Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {ready.length ? (
        <section className="mv-section">
          <h2 className="qh">Ready-made {kind === "email" ? "emails" : "texts"}</h2>
          <p className="when">Use one as it is, or change it to sound like you.</p>
          <ul className="mv-list">
            {ready.map((d) => (
              <li key={d.key} className="mv-item ready">
                <div className="mv-text"><b>{d.name}</b>{d.subject ? <span>{d.subject}</span> : null}<p>{d.body}</p></div>
                <div className="mv-actions"><button type="button" className="btn primary small" disabled={pending} onClick={() => start(async () => { await copyDefaultMessage(d.key); router.refresh(); })}>Use this</button></div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="when">Emails and texts are sent once sending is switched on for the portal. They are paid from your wallet.</p>
    </div>
  );
}
