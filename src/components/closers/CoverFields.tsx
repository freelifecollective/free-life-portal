"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { coverJpeg } from "@/lib/image/cover";

export type CoverValues = { cover_url: string; location: string; experience_text: string; bio: string };

/** The cover card details: a picture, where you are, your experience and a short bio. Sends them with the form it sits in. */
export function CoverFields({ initial, idPrefix }: { initial?: Partial<CoverValues>; idPrefix: string }) {
  const [cover, setCover] = useState(initial?.cover_url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bio, setBio] = useState(initial?.bio ?? "");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("That file is not a picture. Try a JPG or PNG."); return; }
    setBusy(true); setErr("");
    try {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not signed in");
      const path = `${u.user.id}/cover-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, await coverJpeg(f), { contentType: "image/jpeg", cacheControl: "3600" });
      if (error) throw error;
      setCover(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch { setErr("We could not upload that picture. Please try another."); }
    setBusy(false);
  }

  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-cover`}>Your cover photo</label>
        <div className="cover-pick">
          <div className="cover-prev">{cover ? <img src={cover} alt="" /> : <span className="when">No photo yet</span>}</div>
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <label className="btn small" htmlFor={`${idPrefix}-cover`} style={{ cursor: "pointer" }}>{busy ? "Uploading…" : cover ? "Change photo" : "Upload a photo"}</label>
            <input id={`${idPrefix}-cover`} type="file" accept="image/*" onChange={pick} disabled={busy} className="sr-only" />
            <span className="when">Your whole photo is shown, so pick one you love.</span>
          </div>
        </div>
        <input type="hidden" name="cover_url" value={cover} />
        {err ? <p className="err" role="alert" style={{ minHeight: 0 }}>{err}</p> : null}
      </div>
      <div className="row">
        <div className="field"><label htmlFor={`${idPrefix}-loc`}>Where you are</label><input id={`${idPrefix}-loc`} name="location" type="text" required maxLength={80} defaultValue={initial?.location ?? ""} placeholder="City, Country" /></div>
        <div className="field"><label htmlFor={`${idPrefix}-exp`}>Your experience</label><input id={`${idPrefix}-exp`} name="experience_text" type="text" required maxLength={40} defaultValue={initial?.experience_text ?? ""} placeholder="e.g. 2.5 years" /></div>
      </div>
      <div className="field"><label htmlFor={`${idPrefix}-bio`}>Your bio</label>
        <textarea id={`${idPrefix}-bio`} name="bio" required maxLength={600} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A few lines about you and how you work with people" />
        <span className="when" style={{ textAlign: "right" }}>{`${bio.length} / 600`}</span></div>
    </>
  );
}
