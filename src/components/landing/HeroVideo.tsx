"use client";

import { useRef, useState } from "react";
import { LANDING as T } from "./content";

/** The video picture with its play button, the sign-up button under it, and the sign-up box that opens from either. */
export function HeroVideo({ children, videoUrl, poster, cta, joinTitle }: { children: React.ReactNode; videoUrl: string | null; poster: string | null; cta: string; joinTitle: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [playing, setPlaying] = useState(false);
  const open = () => dlg.current?.showModal();
  const play = () => { if (videoUrl) setPlaying(true); else open(); };
  return (
    <>
      <div className="lpn-video">
        {playing && videoUrl ? (
          <iframe src={`${videoUrl}${videoUrl.includes("?") ? "&" : "?"}autoplay=1`} title="Freedom Business Blueprint" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        ) : (
          <button type="button" className="lpn-poster" onClick={play} aria-label={T.hero.play}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster ?? "/landing/blueprint-poster.jpg"} alt={poster ? "" : "Freedom Business Blueprint"} />
          </button>
        )}
      </div>
      <button type="button" className="lpn-cta" onClick={open}>{cta} <span aria-hidden="true">➜</span></button>
      <dialog ref={dlg} className="rs-dialog lpn-dialog" aria-labelledby="lpn-join-title">
        <h2 id="lpn-join-title" className="qh" style={{ marginTop: 0 }}>{joinTitle}</h2>
        {children}
        <div className="dlg-actions"><button type="button" className="linkbtn" onClick={() => dlg.current?.close()}>Close</button></div>
      </dialog>
    </>
  );
}
