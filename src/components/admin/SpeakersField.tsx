"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SpeakerBubbles } from "@/components/calendar/SpeakerBubbles";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_URL } from "@/lib/env";

export type SpeakerValue = { name: string; photo_url: string };
export type Affiliate = { id: string; name: string; photo_url: string | null };
type Row = SpeakerValue & { key: string; busy: boolean };
const MAX = 6;
const OUT = 400; // pictures are saved as 400 x 400 squares and shown round

/** Centre-crops a picture to a square and shrinks it. */
async function square(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = OUT;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, OUT, OUT);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/jpeg", 0.9));
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

/** Admin: who is speaking on the call. Each speaker has a name and a round picture; several speakers overlap a little when shown. */
export function SpeakersField({ initial, affiliates = [] }: { initial: SpeakerValue[]; affiliates?: Affiliate[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((s) => ({ ...s, key: crypto.randomUUID(), busy: false })));
  const [error, setError] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  const patch = (key: string, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function upload(file: File) {
    const key = target.current;
    if (!key) return;
    if (!/^image\//.test(file.type)) return setError("That file is not a picture. Try a JPG or PNG.");
    setError("");
    patch(key, { busy: true });
    try {
      const blob = await square(file);
      const path = `${crypto.randomUUID()}.jpg`;
      const { error: e } = await createClient().storage.from("speakers").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (e) throw e;
      patch(key, { photo_url: `${SUPABASE_URL}/storage/v1/object/public/speakers/${path}`, busy: false });
    } catch {
      patch(key, { busy: false });
      setError("We could not upload that picture. Please try another.");
    }
  }

  return (
    <fieldset className="speakers-field">
      <legend>Speakers</legend>
      <p className="when" style={{ margin: "0 0 10px" }}>Choose a paying affiliate from the list, or type any name, such as a guest. Their profile picture fills in, and you can change the picture for this call only. With more than one, their pictures overlap slightly where people see the call.</p>
      <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
      <ul className="speaker-rows">
        {rows.map((r) => (
          <li key={r.key}>
            <Avatar url={r.photo_url || null} initials={initials(r.name)} size={64} label={r.name || "Speaker"} />
            <div className="speaker-edit">
              {affiliates.length ? (
                <select aria-label="Choose an affiliate" value="" onChange={(e) => { const a = affiliates.find((x) => x.id === e.target.value); if (a) patch(r.key, { name: a.name, photo_url: a.photo_url ?? "" }); }}>
                  <option value="">Choose a paying affiliate (their picture fills in)…</option>
                  {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : null}
              <input type="text" name="speaker_name" maxLength={80} placeholder="Speaker's name" aria-label="Speaker's name" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} />
              <input type="hidden" name="speaker_photo" value={r.photo_url} />
              <span className="speaker-actions">
                <button type="button" className="btn small" disabled={r.busy} onClick={() => { target.current = r.key; pick.current?.click(); }}>{r.busy ? "Uploading…" : r.photo_url ? "Change picture" : "Add a picture"}</button>
                <button type="button" className="linkbtn" onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}>Remove</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {rows.some((r) => r.name.trim()) ? <div style={{ margin: "10px 0" }}><SpeakerBubbles speakers={rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), photo_url: r.photo_url || null }))} label="Preview" /></div> : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
      {rows.length < MAX ? <button type="button" className="btn" onClick={() => setRows((cur) => [...cur, { key: crypto.randomUUID(), name: "", photo_url: "", busy: false }])}>{rows.length ? "Add another speaker" : "Add a speaker"}</button> : null}
    </fieldset>
  );
}
