"use client";

import { useRef, useState } from "react";
import type { Layout } from "@/lib/graphics/layout";
import { GraphicCanvas } from "./GraphicCanvas";

export type Template = { id: string; title: string; image_url: string; layout: Layout };

/** Pick a template; your photo, name and link are put on it. Add your own words if the template has room, then download it. */
export function GraphicMaker({ templates, name, photoUrl, link }: { templates: Template[]; name: string; photoUrl: string | null; link: string }) {
  const [id, setId] = useState(templates[0]?.id ?? "");
  const t = templates.find((x) => x.id === id) ?? templates[0];
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [show, setShow] = useState({ photo: true, name: true, link: true });
  const [msg, setMsg] = useState("");
  const canvas = useRef<HTMLCanvasElement | null>(null);
  if (!t) return null;
  const text = texts[t.id] ?? t.layout.text.default;
  const download = () => {
    const c = canvas.current;
    if (!c) return;
    setMsg("");
    c.toBlob((b) => {
      if (!b) { setMsg("We could not make the picture. Please try again."); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = `${t.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "graphic"}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  };
  return (
    <div className="gm">
      <div className="gm-pick" role="listbox" aria-label="Templates">
        {templates.map((x) => (
          <button key={x.id} type="button" role="option" aria-selected={x.id === t.id} className={"gm-thumb" + (x.id === t.id ? " on" : "")} onClick={() => setId(x.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.image_url} alt="" /><span translate="no">{x.title}</span>
          </button>
        ))}
      </div>
      <div className="gm-main">
        <div className="gm-preview"><GraphicCanvas ref={canvas} bgUrl={t.image_url} layout={t.layout} data={{ name, link, text, photoUrl, show }} /></div>
        <div className="gm-controls card-s">
          {t.layout.text.on ? (
            <div className="field"><label htmlFor="gm-text">Your words</label><textarea id="gm-text" rows={3} maxLength={140} value={text} onChange={(e) => setTexts((cur) => ({ ...cur, [t.id]: e.target.value }))} /></div>
          ) : null}
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
            <legend className="when" style={{ padding: 0 }}>Show on the picture</legend>
            {t.layout.photo.on ? <label className="check" style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={show.photo} onChange={(e) => setShow((s) => ({ ...s, photo: e.target.checked }))} /> My photo</label> : null}
            {t.layout.name.on ? <label className="check" style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={show.name} onChange={(e) => setShow((s) => ({ ...s, name: e.target.checked }))} /> My name</label> : null}
            {t.layout.link.on ? <label className="check" style={{ display: "flex", gap: 8 }}><input type="checkbox" checked={show.link} onChange={(e) => setShow((s) => ({ ...s, link: e.target.checked }))} /> My invite link</label> : null}
          </fieldset>
          <button type="button" className="btn primary" onClick={download}>Download picture</button>
          {msg ? <p className="err" role="alert" style={{ minHeight: 0 }}>{msg}</p> : null}
          <p className="when" style={{ margin: 0 }}>Post it on your story or page. Your invite link takes people to your page.</p>
        </div>
      </div>
    </div>
  );
}
