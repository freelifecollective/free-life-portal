"use client";

import { useRef, useState } from "react";
import { SUPABASE_URL } from "@/lib/env";
import { toEmbedUrl } from "@/lib/landing/video";
import { createClient } from "@/lib/supabase/client";
import { ELEMENT_LABELS, FIELD_LABELS, FONTS, type El, type FormField, type PageSettings, type Style } from "@/lib/funnels/types";
import type { Kind } from "./tree";

/* The panel on the right of the editor: what the chosen piece says, and how it looks. */

const NAMES: Record<Kind, string> = { section: "Section", row: "Row", column: "Column", element: "Element" };

function Num({ label, value, onChange, min = 0, max = 400, step = 1 }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="fe-num"><span>{label}</span>
      <input type="number" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Math.max(min, Math.min(max, Number(e.target.value))))} />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
  return (
    <label className="fe-color"><span>{label}</span>
      <span className="fe-color-row">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour`} />
        <input type="text" value={value ?? ""} placeholder="none" maxLength={30} onChange={(e) => onChange(e.target.value.trim() || undefined)} />
        {value ? <button type="button" className="fe-x" onClick={() => onChange(undefined)} aria-label={`Clear ${label}`}>×</button> : null}
      </span>
    </label>
  );
}

/** Four boxes: top, right, bottom, left. */
function Box({ label, value, onChange, min = 0 }: { label: string; value: [number, number, number, number] | undefined; onChange: (v: [number, number, number, number] | undefined) => void; min?: number }) {
  const v = value ?? [0, 0, 0, 0];
  const set = (i: number, n: number) => { const next = [...v] as [number, number, number, number]; next[i] = n; onChange(next.every((x) => x === 0) ? undefined : next); };
  return (
    <div className="fe-box"><span>{label}</span>
      <div className="fe-box-grid">
        {["Top", "Right", "Bottom", "Left"].map((s, i) => (
          <label key={s}><small>{s}</small><input type="number" min={min} max={400} value={v[i]} onChange={(e) => set(i, Number(e.target.value) || 0)} /></label>
        ))}
      </div>
    </div>
  );
}

function Select<T extends string>({ label, value, options, onChange, empty = "Default" }: { label: string; value: T | undefined; options: readonly (readonly [T, string])[]; onChange: (v: T | undefined) => void; empty?: string }) {
  return (
    <label className="fe-select"><span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
        <option value="">{empty}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Upload a picture (shrunk to at most 2000px) to the member's own folder and hand back its address. */
async function upload(userId: string, file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const png = file.type === "image/png";
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export"))), png ? "image/png" : "image/jpeg", 0.88));
  const path = `${userId}/funnels/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${png ? "png" : "jpg"}`;
  const { error } = await createClient().storage.from("landing").upload(path, blob, { contentType: png ? "image/png" : "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return `${SUPABASE_URL}/storage/v1/object/public/landing/${path}`;
}

function ImagePicker({ userId, value, onChange, label }: { userId: string; value: string | undefined; onChange: (v: string | undefined) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="fe-field"><span>{label}</span>
      <div className="fe-img-row">
        <button type="button" className="btn small" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : "Upload picture"}</button>
        {value ? <button type="button" className="linkbtn" onClick={() => onChange(undefined)}>Remove</button> : null}
      </div>
      <input type="url" placeholder="or paste a picture link (https://…)" value={value ?? ""} onChange={(e) => onChange(e.target.value.trim() || undefined)} />
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f) return;
        if (!/^image\//.test(f.type) || f.size > 15 * 1024 * 1024) { setErr("Choose a picture under 15 MB."); return; }
        setBusy(true); setErr("");
        try { onChange(await upload(userId, f)); } catch { setErr("We could not upload that picture. Please try another."); }
        setBusy(false);
      }} />
      {err ? <p className="status bad">{err}</p> : null}
    </div>
  );
}

/** Content settings for an element: the words, picture, video, link or form fields. */
function Content({ el, steps, userId, set }: { el: El; steps: { slug: string; name: string }[]; userId: string; set: (change: (e: El) => void) => void }) {
  const p = el.props;
  const [videoLink, setVideoLink] = useState(p.video ?? "");
  const [videoErr, setVideoErr] = useState("");
  return (
    <div className="fe-group">
      {["headline", "subheadline", "text"].includes(el.type) ? (
        <label className="fe-field"><span>Words</span><textarea rows={el.type === "text" ? 6 : 3} value={p.text ?? ""} onChange={(e) => set((x) => { x.props.text = e.target.value; })} /></label>
      ) : null}
      {el.type === "button" ? (
        <>
          <label className="fe-field"><span>Button words</span><input type="text" value={p.text ?? ""} onChange={(e) => set((x) => { x.props.text = e.target.value; })} /></label>
          <label className="fe-field"><span>Small line under it (optional)</span><input type="text" value={p.subtext ?? ""} onChange={(e) => set((x) => { x.props.subtext = e.target.value; })} /></label>
          <Select label="When clicked, go to" value={p.action} options={[["next", "The next page of this funnel"], ["step", "A page of this funnel"], ["url", "A web address"]] as const} onChange={(v) => set((x) => { x.props.action = v ?? "next"; })} empty="The next page of this funnel" />
          {p.action === "step" ? <Select label="Page" value={p.step} options={steps.map((s) => [s.slug, s.name] as const)} onChange={(v) => set((x) => { x.props.step = v; })} empty="Choose a page" /> : null}
          {p.action === "url" ? <label className="fe-field"><span>Web address</span><input type="url" placeholder="https://…" value={p.href ?? ""} onChange={(e) => set((x) => { x.props.href = e.target.value; })} /></label> : null}
        </>
      ) : null}
      {el.type === "image" ? (
        <>
          <ImagePicker userId={userId} label="Picture" value={p.src || undefined} onChange={(v) => set((x) => { x.props.src = v ?? ""; })} />
          <label className="fe-field"><span>Describe the picture (for screen readers)</span><input type="text" value={p.alt ?? ""} onChange={(e) => set((x) => { x.props.alt = e.target.value; })} /></label>
          <label className="fe-field"><span>Link when clicked (optional)</span><input type="url" placeholder="https://…" value={p.href ?? ""} onChange={(e) => set((x) => { x.props.href = e.target.value || undefined; })} /></label>
        </>
      ) : null}
      {el.type === "video" ? (
        <label className="fe-field"><span>Vimeo or YouTube link</span>
          <input type="url" placeholder="https://vimeo.com/…" value={videoLink} onChange={(e) => { setVideoLink(e.target.value); const u = toEmbedUrl(e.target.value); setVideoErr(e.target.value && !u ? "Paste a link to a video on Vimeo or YouTube." : ""); if (u || !e.target.value) set((x) => { x.props.video = u ?? ""; }); }} />
          {videoErr ? <small className="status bad">{videoErr}</small> : null}
        </label>
      ) : null}
      {el.type === "form" ? (
        <>
          <div className="fe-field"><span>Boxes on the form</span>
            {(Object.keys(FIELD_LABELS) as FormField[]).map((f) => (
              <label key={f} className="fe-check"><input type="checkbox" checked={(p.fields ?? []).includes(f)} onChange={(e) => set((x) => { const cur = new Set(x.props.fields ?? []); if (e.target.checked) cur.add(f); else cur.delete(f); x.props.fields = (Object.keys(FIELD_LABELS) as FormField[]).filter((k) => cur.has(k)); })} /> {FIELD_LABELS[f]}</label>
            ))}
          </div>
          <label className="fe-field"><span>Button words</span><input type="text" value={p.buttonText ?? ""} onChange={(e) => set((x) => { x.props.buttonText = e.target.value; })} /></label>
          <p className="when" style={{ margin: 0 }}>After someone fills it in, they go to the next page of this funnel. You see who signed up under Forms.</p>
        </>
      ) : null}
      {el.type === "list" ? (
        <label className="fe-field"><span>One point per line</span><textarea rows={5} value={(p.items ?? []).join("\n")} onChange={(e) => set((x) => { x.props.items = e.target.value.split("\n"); })} /></label>
      ) : null}
      {el.type === "spacer" || el.type === "divider" ? <Num label={el.type === "spacer" ? "Height" : "Line thickness"} value={p.height} max={el.type === "spacer" ? 400 : 20} onChange={(v) => set((x) => { x.props.height = v; })} /> : null}
      {el.type === "button" || el.type === "form" ? (
        <>
          <Color label="Button colour" value={p.buttonColor} onChange={(v) => set((x) => { x.props.buttonColor = v; })} />
          <Color label="Button text colour" value={p.buttonTextColor} onChange={(v) => set((x) => { x.props.buttonTextColor = v; })} />
        </>
      ) : null}
    </div>
  );
}

/** How any piece looks: spacing, background, words, corners, border and shadow. */
function Look({ kind, type, style, set, userId }: { kind: Kind; type?: El["type"]; style: Style; set: (change: (s: Style) => void) => void; userId: string }) {
  const textual = kind !== "element" || ["headline", "subheadline", "text", "button", "list"].includes(type ?? "");
  return (
    <div className="fe-group">
      <Box label="Padding (space inside)" value={style.padding} onChange={(v) => set((s) => { s.padding = v; })} />
      <Box label="Margin (space outside)" value={style.margin} min={-200} onChange={(v) => set((s) => { s.margin = v; })} />
      {kind !== "column" ? <Num label="Widest size (px)" value={style.maxWidth} min={100} max={2000} onChange={(v) => set((s) => { s.maxWidth = v; })} /> : null}
      {textual ? (
        <>
          <Select label="Font" value={style.fontFamily as (typeof FONTS)[number] | undefined} options={FONTS.map((f) => [f, f] as const)} onChange={(v) => set((s) => { s.fontFamily = v; })} />
          <div className="fe-pair">
            <Num label="Size" value={style.fontSize} min={8} max={120} onChange={(v) => set((s) => { s.fontSize = v; })} />
            <Select label="Weight" value={style.fontWeight ? String(style.fontWeight) as "400" : undefined} options={[["300", "Light"], ["400", "Regular"], ["600", "Semi-bold"], ["700", "Bold"], ["900", "Black"]] as const} onChange={(v) => set((s) => { s.fontWeight = v ? Number(v) : undefined; })} />
          </div>
          <div className="fe-pair">
            <Num label="Line height" value={style.lineHeight} min={0.8} max={3} step={0.1} onChange={(v) => set((s) => { s.lineHeight = v; })} />
            <Num label="Letter spacing" value={style.letterSpacing} min={-5} max={20} step={0.5} onChange={(v) => set((s) => { s.letterSpacing = v; })} />
          </div>
          <div className="fe-toggles">
            <label className="fe-check"><input type="checkbox" checked={!!style.italic} onChange={(e) => set((s) => { s.italic = e.target.checked || undefined; })} /> Italic</label>
            <label className="fe-check"><input type="checkbox" checked={!!style.uppercase} onChange={(e) => set((s) => { s.uppercase = e.target.checked || undefined; })} /> Capitals</label>
          </div>
          <Color label="Text colour" value={style.color} onChange={(v) => set((s) => { s.color = v; })} />
        </>
      ) : null}
      {type === "divider" ? <Color label="Line colour" value={style.color} onChange={(v) => set((s) => { s.color = v; })} /> : null}
      <Select label="Line up" value={style.align} options={[["left", "Left"], ["center", "Centre"], ["right", "Right"]] as const} onChange={(v) => set((s) => { s.align = v; })} />
      <Color label="Background" value={style.background} onChange={(v) => set((s) => { s.background = v; })} />
      {kind === "section" || kind === "row" ? <ImagePicker userId={userId} label="Background picture" value={style.backgroundImage} onChange={(v) => set((s) => { s.backgroundImage = v; })} /> : null}
      <div className="fe-pair">
        <Num label="Rounded corners" value={style.radius} max={200} onChange={(v) => set((s) => { s.radius = v; })} />
        <Select label="Shadow" value={style.shadow} options={[["none", "None"], ["sm", "Small"], ["md", "Medium"], ["lg", "Large"]] as const} onChange={(v) => set((s) => { s.shadow = v; })} />
      </div>
      <div className="fe-pair">
        <Num label="Border" value={style.borderWidth} max={20} onChange={(v) => set((s) => { s.borderWidth = v; })} />
        <Color label="Border colour" value={style.borderColor} onChange={(v) => set((s) => { s.borderColor = v; })} />
      </div>
    </div>
  );
}

export function PageSettingsPanel({ settings, set }: { settings: PageSettings; set: (change: (s: PageSettings) => void) => void }) {
  return (
    <div className="fe-group">
      <p className="fe-hint">Click anything on the page to change it. With nothing chosen, these settings are for the whole page.</p>
      <label className="fe-field"><span>Page title (shown in the browser tab)</span><input type="text" maxLength={120} value={settings.title ?? ""} onChange={(e) => set((s) => { s.title = e.target.value; })} /></label>
      <Select label="Font" value={settings.fontFamily as (typeof FONTS)[number] | undefined} options={FONTS.map((f) => [f, f] as const)} onChange={(v) => set((s) => { s.fontFamily = v; })} />
      <Color label="Text colour" value={settings.color} onChange={(v) => set((s) => { s.color = v; })} />
      <Color label="Page background" value={settings.background} onChange={(v) => set((s) => { s.background = v; })} />
    </div>
  );
}

export function SettingsPanel(props: {
  kind: Kind; el?: El; style: Style; columns?: number; steps: { slug: string; name: string }[]; userId: string;
  setEl: (change: (e: El) => void) => void; setStyle: (change: (s: Style) => void) => void; setColumns?: (n: number) => void;
}) {
  const [tab, setTab] = useState<"content" | "look">(props.kind === "element" ? "content" : "look");
  const title = props.el ? ELEMENT_LABELS[props.el.type] : NAMES[props.kind];
  return (
    <div>
      <h2 className="fe-panel-h">{title}</h2>
      {props.kind === "element" ? (
        <div className="fe-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "content"} className={tab === "content" ? "on" : ""} onClick={() => setTab("content")}>Content</button>
          <button type="button" role="tab" aria-selected={tab === "look"} className={tab === "look" ? "on" : ""} onClick={() => setTab("look")}>Look</button>
        </div>
      ) : null}
      {props.kind === "row" && props.setColumns ? (
        <div className="fe-field"><span>Columns</span>
          <div className="fe-cols">{[1, 2, 3, 4].map((n) => <button key={n} type="button" className={props.columns === n ? "on" : ""} onClick={() => props.setColumns!(n)} aria-label={`${n} columns`}>{Array.from({ length: n }, (_, i) => <i key={i} />)}</button>)}</div>
        </div>
      ) : null}
      {props.kind === "element" && props.el && tab === "content" ? <Content key={props.el.id} el={props.el} steps={props.steps} userId={props.userId} set={props.setEl} /> : null}
      {tab === "look" || props.kind !== "element" ? <Look kind={props.kind} type={props.el?.type} style={props.style} set={props.setStyle} userId={props.userId} /> : null}
    </div>
  );
}
