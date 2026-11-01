"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTemplate, deleteTemplate, saveTemplate } from "@/app/(app)/admin/graphics/actions";
import { coverJpeg } from "@/lib/image/cover";
import type { Layout, TextEl } from "@/lib/graphics/layout";
import { createClient } from "@/lib/supabase/client";
import { GraphicCanvas } from "./GraphicCanvas";
import type { Template } from "./GraphicMaker";

type Row = Template & { published: boolean };

const Slider = ({ label, value, min, max, step = 0.5, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) => (
  <label className="gm-slide"><span>{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /><b>{Math.round(value * 10) / 10}</b></label>
);

function TextControls({ title, el, onChange, extra }: { title: string; el: TextEl; onChange: (e: TextEl) => void; extra?: React.ReactNode }) {
  return (
    <fieldset className="gm-fs">
      <legend><label className="check" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={el.on} onChange={(e) => onChange({ ...el, on: e.target.checked })} /> {title}</label></legend>
      {el.on ? (
        <>
          <Slider label="Across" value={el.x} min={0} max={100} onChange={(x) => onChange({ ...el, x })} />
          <Slider label="Down" value={el.y} min={0} max={100} onChange={(y) => onChange({ ...el, y })} />
          <Slider label="Size" value={el.size} min={1} max={14} step={0.1} onChange={(size) => onChange({ ...el, size })} />
          <div className="rs-actions" style={{ marginTop: 0 }}>
            <label className="gm-color">Colour <input type="color" value={el.color} onChange={(e) => onChange({ ...el, color: e.target.value.toUpperCase() })} /></label>
            <select value={el.align} onChange={(e) => onChange({ ...el, align: e.target.value as TextEl["align"] })} aria-label="Alignment"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
            <label className="check" style={{ display: "inline-flex", gap: 6 }}><input type="checkbox" checked={el.bold} onChange={(e) => onChange({ ...el, bold: e.target.checked })} /> Bold</label>
          </div>
          {extra}
        </>
      ) : null}
    </fieldset>
  );
}

function Editor({ row, sample }: { row: Row; sample: { name: string; photoUrl: string | null; link: string } }) {
  const router = useRouter();
  const [title, setTitle] = useState(row.title);
  const [published, setPublished] = useState(row.published);
  const [l, setL] = useState<Layout>(row.layout);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="gm-edit">
      <div className="gm-preview"><GraphicCanvas bgUrl={row.image_url} layout={l} data={{ name: sample.name, link: sample.link, text: l.text.default, photoUrl: sample.photoUrl, show: { photo: true, name: true, link: true } }} /></div>
      <div className="set-form">
        <div className="field"><label htmlFor={`gt-${row.id}`}>Template title</label><input id={`gt-${row.id}`} type="text" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <fieldset className="gm-fs">
          <legend><label className="check" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={l.photo.on} onChange={(e) => setL({ ...l, photo: { ...l.photo, on: e.target.checked } })} /> Member photo</label></legend>
          {l.photo.on ? (
            <>
              <Slider label="Across" value={l.photo.x} min={0} max={100} onChange={(x) => setL({ ...l, photo: { ...l.photo, x } })} />
              <Slider label="Down" value={l.photo.y} min={0} max={100} onChange={(y) => setL({ ...l, photo: { ...l.photo, y } })} />
              <Slider label="Size" value={l.photo.size} min={3} max={80} onChange={(size) => setL({ ...l, photo: { ...l.photo, size } })} />
              <select value={l.photo.shape} onChange={(e) => setL({ ...l, photo: { ...l.photo, shape: e.target.value as "circle" | "square" } })} aria-label="Shape"><option value="circle">Circle</option><option value="square">Square</option></select>
            </>
          ) : null}
        </fieldset>
        <TextControls title="Member name" el={l.name} onChange={(name) => setL({ ...l, name })} />
        <TextControls title="Invite link" el={l.link} onChange={(link) => setL({ ...l, link })} />
        <TextControls title="Words the member can change" el={l.text} onChange={(t) => setL({ ...l, text: { ...t, default: l.text.default } })}
          extra={<div className="field"><label htmlFor={`gd-${row.id}`}>Starting words</label><input id={`gd-${row.id}`} type="text" maxLength={140} value={l.text.default} onChange={(e) => setL({ ...l, text: { ...l.text, default: e.target.value } })} /></div>} />
        <label className="check" style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <span>Show this template to members</span></label>
        <div className="rs-actions" style={{ marginTop: 0 }}>
          <button type="button" className="btn small primary" disabled={pending} onClick={() => start(async () => { const r = await saveTemplate(row.id, title, published, l); setMsg(r.ok ? "Saved." : r.error); router.refresh(); })}>Save template</button>
          <button type="button" className="linkbtn danger" disabled={pending} onClick={() => { if (window.confirm("Delete this template?")) start(async () => { await deleteTemplate(row.id); router.refresh(); }); }}>Delete template</button>
          <span role="status" className="when">{msg}</span>
        </div>
      </div>
    </div>
  );
}

/** Upload template pictures and set where the member's photo, name and link go. */
export function TemplateAdmin({ rows, sample }: { rows: Row[]; sample: { name: string; photoUrl: string | null; link: string } }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("That file is not a picture. Try a JPG or PNG."); return; }
    if (!title.trim()) { setError("Give the template a title first."); return; }
    setBusy(true); setError("");
    try {
      const s = createClient();
      const { data: u } = await s.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const path = `${u.user.id}/template-${crypto.randomUUID()}.jpg`;
      const up = await s.storage.from("avatars").upload(path, await coverJpeg(f), { contentType: "image/jpeg", cacheControl: "3600" });
      if (up.error) throw up.error;
      const r = await createTemplate(title, s.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      if (!r.ok) setError(r.error); else { setTitle(""); router.refresh(); }
    } catch { setError("We could not upload that picture. Please try another."); }
    setBusy(false);
  }
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <section className="card-s">
        <h2 className="qh" style={{ marginTop: 0 }}>Add a template</h2>
        <p className="when" style={{ marginTop: 0 }}>Upload the picture members will put their photo and name on (for example a square 1080 by 1080 post). Then place things on it below.</p>
        <div className="rs-actions" style={{ marginTop: 0 }}>
          <input type="text" maxLength={80} placeholder="Template title" aria-label="Template title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="btn small primary" style={{ cursor: "pointer" }}>{busy ? "Uploading…" : "Upload picture"}<input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={upload} /></label>
        </div>
        {error ? <p className="err" role="alert">{error}</p> : null}
      </section>
      {rows.map((r) => <section key={r.id} className="card-s"><h2 className="qh" style={{ marginTop: 0 }} translate="no">{r.title}</h2><Editor row={r} sample={sample} /></section>)}
    </div>
  );
}
