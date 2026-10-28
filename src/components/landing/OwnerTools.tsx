"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveLandingLinks, saveLandingPhoto } from "@/app/[username]/actions";
import { SUPABASE_URL } from "@/lib/env";
import { HANDLE_MESSAGES, cleanHandle, handleState } from "@/lib/handles";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 15 * 1024 * 1024;

/** Shrink a photo to at most 1200px on its longest side and save it as a JPEG, so uploads stay small. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/jpeg", 0.9));
}

/** Shown only to the member whose page this is. */
export function OwnerTools({ userId, instagram, facebook, hasPagePhoto }: { userId: string; instagram: string | null; facebook: string | null; hasPagePhoto: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [ig, setIg] = useState(instagram ?? "");
  const [fb, setFb] = useState(facebook ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const igState = handleState(ig, "instagram"), fbState = handleState(fb, "facebook");
  const linksValid = igState !== "bad" && fbState !== "bad";

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) return setMsg({ ok: false, text: "That file is not an image. Try a JPG or PNG." });
    if (file.size > MAX_BYTES) return setMsg({ ok: false, text: "That photo is over 15 MB. Try a smaller one." });
    setMsg(null);
    start(async () => {
      try {
        const blob = await shrink(file);
        const path = `${userId}/photo.jpg`;
        const { error } = await createClient().storage.from("landing").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
        if (error) throw error;
        const r = await saveLandingPhoto(`${SUPABASE_URL}/storage/v1/object/public/landing/${path}?v=${Date.now()}`);
        setMsg(r.ok ? { ok: true, text: "Picture updated." } : { ok: false, text: r.error ?? "Something went wrong." });
        if (r.ok) router.refresh();
      } catch {
        setMsg({ ok: false, text: "We could not upload that picture. Please try another." });
      }
    });
  }

  function useProfilePicture() {
    setMsg(null);
    start(async () => {
      const r = await saveLandingPhoto(null);
      setMsg(r.ok ? { ok: true, text: "Now using your profile picture." } : { ok: false, text: r.error ?? "Something went wrong." });
      if (r.ok) router.refresh();
    });
  }

  function saveLinks(alsoProfile: boolean) {
    dialogRef.current?.close();
    setMsg(null);
    start(async () => {
      const r = await saveLandingLinks({ instagram: ig, facebook: fb, alsoProfile });
      if (r.ok) { setEditing(false); setMsg({ ok: true, text: alsoProfile ? "Links updated on your page and your portal profile." : "Links updated on your landing page." }); router.refresh(); }
      else setMsg({ ok: false, text: r.error ?? "Something went wrong." });
    });
  }

  return (
    <div className="owner-tools" aria-label="Edit your page">
      <p className="owner-note">Only you can see these buttons.</p>
      <div className="owner-row">
        <button type="button" className="btn small" disabled={pending} onClick={() => fileRef.current?.click()}>Change photo</button>
        {hasPagePhoto ? <button type="button" className="linkbtn" disabled={pending} onClick={useProfilePicture}>Use my profile picture</button> : null}
        <button type="button" className="btn small" disabled={pending} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>Edit links</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
      {editing ? (
        <form className="owner-links" noValidate onSubmit={(e) => { e.preventDefault(); if (linksValid) dialogRef.current?.showModal(); }}>
          <div className="field"><label htmlFor="own-ig">Instagram handle</label>
            <div className="handle"><span className="at">@</span><input id="own-ig" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} value={ig} onChange={(e) => setIg(e.target.value)} onBlur={() => igState === "ok" && setIg(cleanHandle(ig, "instagram"))} /></div></div>
          {igState === "bad" ? <p className="status bad">{HANDLE_MESSAGES.instagram}</p> : null}
          <div className="field"><label htmlFor="own-fb">Facebook handle</label>
            <div className="handle"><span className="at">@</span><input id="own-fb" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} value={fb} onChange={(e) => setFb(e.target.value)} onBlur={() => fbState === "ok" && setFb(cleanHandle(fb, "facebook"))} /></div></div>
          {fbState === "bad" ? <p className="status bad">{HANDLE_MESSAGES.facebook}</p> : null}
          <p className="owner-hint">Leave a box empty to hide that button.</p>
          <button type="submit" className="btn primary small" disabled={pending || !linksValid}>Update</button>
        </form>
      ) : null}
      <p className={"status" + (msg ? (msg.ok ? " ok" : " bad") : "")} role="status" style={{ minHeight: 20 }}>{msg?.text ?? ""}</p>

      <dialog ref={dialogRef} className="owner-dialog" aria-labelledby="own-dlg-title">
        <h2 id="own-dlg-title">Do you want to update your social links on your Portal Profile as well or only your landing page?</h2>
        <div className="owner-dialog-actions">
          <button type="button" className="btn primary" onClick={() => saveLinks(true)}>Portal profile and landing page</button>
          <button type="button" className="btn" onClick={() => saveLinks(false)}>Only my landing page</button>
          <button type="button" className="linkbtn" onClick={() => dialogRef.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </div>
  );
}
