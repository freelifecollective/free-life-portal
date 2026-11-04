"use client";

import { useRef, useState } from "react";
import { CaptionHint } from "./CaptionHint";
import { LANDING as T } from "./content";

/** The video picture with its play button, the sign-up button under it, and the sign-up box that opens from either. */
export function HeroVideo({ children }: { children: React.ReactNode }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [playing, setPlaying] = useState(false);
  const open = () => dlg.current?.showModal();
  const play = () => { if (T.videoEmbedUrl) setPlaying(true); else open(); };
  return (
    <>
      <div className="lpn-video">
        {playing && T.videoEmbedUrl ? (
          <iframe src={`${T.videoEmbedUrl}${T.videoEmbedUrl.includes("?") ? "&" : "?"}autoplay=1`} title="Freedom Business Blueprint" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        ) : (
          <button type="button" className="lpn-poster" onClick={play} aria-label={T.hero.play}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/blueprint-poster.jpg" alt="Freedom Business Blueprint" />
          </button>
        )}
      </div>
      <CaptionHint />
      <button type="button" className="lpn-cta" onClick={open}>{T.hero.cta} <span aria-hidden="true">➜</span></button>
      <dialog ref={dlg} className="rs-dialog lpn-dialog" aria-labelledby="lpn-join-title">
        <h2 id="lpn-join-title" className="qh" style={{ marginTop: 0 }}>{T.join.title}</h2>
        {children}
        <div className="dlg-actions"><button type="button" className="linkbtn" onClick={() => dlg.current?.close()}>Close</button></div>
      </dialog>
    </>
  );
}
