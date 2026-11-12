"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveLandingPoster, saveLandingVideo, saveLandingWords } from "@/app/(app)/advertising/landing-page/actions";
import { SUPABASE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { COPY_FIELDS, type LandingCopy } from "./content";

const MAX_BYTES = 15 * 1024 * 1024;

/** Shrink a picture to at most 1600px on its longest side and save it as a JPEG, so uploads stay small. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/jpeg", 0.88));
}

type Msg = { ok: boolean; text: string } | null;

/** Builder and Leader: change the words, the video and the picture on the video. */
export function LandingCustomizer({ userId, copy, videoUrl, posterUrl }: { userId: string; copy: LandingCopy | null; videoUrl: string | null; posterUrl: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [words, setWords] = useState<Record<string, string>>(() => Object.fromEntries(COPY_FIELDS.map((f) => [f.key, copy?.[f.key] ?? ""])));
  const [link, setLink] = useState(videoUrl ?? "");
  const [wordsMsg, setWordsMsg] = useState<Msg>(null);
  const [videoMsg, setVideoMsg] = useState<Msg>(null);
  const [picMsg, setPicMsg] = useState<Msg>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const done = (set: (m: Msg) => void, okText: string) => (r: { ok: boolean; error?: string }) => {
    set(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Something went wrong." });
    if (r.ok) router.refresh();
  };

  function pickPicture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) return setPicMsg({ ok: false, text: "That file is not an image. Try a JPG or PNG." });
    if (file.size > MAX_BYTES) return setPicMsg({ ok: false, text: "That picture is over 15 MB. Try a smaller one." });
    setPicMsg(null);
    start(async () => {
      try {
        const blob = await shrink(file);
        const path = `${userId}/poster.jpg`;
        const { error } = await createClient().storage.from("landing").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
        if (error) throw error;
        done(setPicMsg, "Picture updated.")(await saveLandingPoster(`${SUPABASE_URL}/storage/v1/object/public/landing/${path}?v=${Date.now()}`));
      } catch {
        setPicMsg({ ok: false, text: "We could not upload that picture. Please try another." });
      }
    });
  }

  return (
    <div className="lpc">
      <section className="lpc-card" aria-labelledby="lpc-words">
        <h2 id="lpc-words" className="qh lpc-h">Your words</h2>
        <p className="when">Leave a box empty to use the standard words, shown in grey.</p>
        <form className="lpc-form" onSubmit={(e) => { e.preventDefault(); setWordsMsg(null); start(async () => done(setWordsMsg, "Your words are on your page.")(await saveLandingWords(words))); }}>
          {COPY_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`lc-${f.key}`}>{f.label}</label>
              {f.long ? (
                <textarea id={`lc-${f.key}`} rows={3} maxLength={f.max} placeholder={f.standard} value={words[f.key]} onChange={(e) => setWords({ ...words, [f.key]: e.target.value })} />
              ) : (
                <input id={`lc-${f.key}`} type="text" maxLength={f.max} placeholder={f.standard} value={words[f.key]} onChange={(e) => setWords({ ...words, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="lpc-actions">
            <button type="submit" className="btn primary" disabled={pending}>Save my words</button>
            <button type="button" className="linkbtn" disabled={pending} onClick={() => { const empty = Object.fromEntries(COPY_FIELDS.map((f) => [f.key, ""])); setWords(empty); setWordsMsg(null); start(async () => done(setWordsMsg, "Back to the standard words.")(await saveLandingWords(empty))); }}>Use the standard words</button>
          </div>
          <p className={"status" + (wordsMsg ? (wordsMsg.ok ? " ok" : " bad") : "")} role="status">{wordsMsg?.text ?? ""}</p>
        </form>
      </section>

      <section className="lpc-card" aria-labelledby="lpc-video">
        <h2 id="lpc-video" className="qh lpc-h">Your video</h2>
        <p className="when">Paste a link to your video on Vimeo or YouTube. Leave it empty to use the standard video.</p>
        <form className="lpc-row" onSubmit={(e) => { e.preventDefault(); setVideoMsg(null); start(async () => done(setVideoMsg, link.trim() ? "Your video is on your page." : "Back to the standard video.")(await saveLandingVideo(link))); }}>
          <label className="sr-only" htmlFor="lpc-link">Video link</label>
          <input id="lpc-link" type="url" inputMode="url" placeholder="https://vimeo.com/..." value={link} onChange={(e) => setLink(e.target.value)} />
          <button type="submit" className="btn primary" disabled={pending}>Save video</button>
        </form>
        <p className={"status" + (videoMsg ? (videoMsg.ok ? " ok" : " bad") : "")} role="status">{videoMsg?.text ?? ""}</p>

        <h3 className="lpc-h3">Picture on the video</h3>
        <div className="lpc-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lpc-poster" src={posterUrl ?? "/landing/blueprint-poster.jpg"} alt="" />
          <div className="lpc-poster-actions">
            <button type="button" className="btn" disabled={pending} onClick={() => fileRef.current?.click()}>Change picture</button>
            {posterUrl ? <button type="button" className="linkbtn" disabled={pending} onClick={() => { setPicMsg(null); start(async () => done(setPicMsg, "Back to the standard picture.")(await saveLandingPoster(null))); }}>Use the standard picture</button> : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPicture} />
        </div>
        <p className={"status" + (picMsg ? (picMsg.ok ? " ok" : " bad") : "")} role="status">{picMsg?.text ?? ""}</p>
      </section>
    </div>
  );
}
