"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { coverJpeg } from "@/lib/image/cover";
import { createClient } from "@/lib/supabase/client";

/** Upload a cover photo for a course. Reports the picture's address through onChange. */
export function CourseCoverField({ value, onChange, idPrefix }: { value: string; onChange: (url: string) => void; idPrefix: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
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
      const path = `${u.user.id}/course-${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, await coverJpeg(f), { contentType: "image/jpeg", cacheControl: "3600" });
      if (error) throw error;
      onChange(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch { setErr("We could not upload that picture. Please try another."); }
    setBusy(false);
  }
  return (
    <div className="field">
      <label htmlFor={`${idPrefix}-cover`}>Cover photo</label>
      <div className="cover-pick">
        <div className="cover-prev">{value ? <img src={value} alt="" /> : <span className="when">No photo yet</span>}</div>
        <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
          <label className="btn small" htmlFor={`${idPrefix}-cover`} style={{ cursor: "pointer" }}>{busy ? "Uploading…" : value ? "Change photo" : "Upload a photo"}</label>
          <input id={`${idPrefix}-cover`} type="file" accept="image/*" onChange={pick} disabled={busy} className="sr-only" />
          {value ? <button type="button" className="linkbtn" style={{ padding: 0, textAlign: "left" }} onClick={() => onChange("")}>Remove photo</button> : null}
          <span className="when">This is the picture people see on the Courses page.</span>
        </div>
      </div>
      {err ? <p className="err" role="alert" style={{ minHeight: 0 }}>{err}</p> : null}
    </div>
  );
}
