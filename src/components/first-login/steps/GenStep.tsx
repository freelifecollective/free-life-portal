"use client";

import { useEffect, useRef, useState } from "react";
import { newBatch, type Spec } from "@/lib/avatar/palettes";
import { renderAvatar } from "@/lib/avatar/render";
import { displayFont, makePic, renderCtx, type Flow, type StepProps } from "../flow";
import { usePhotoPicker } from "./PictureStep";

function Thumb({ spec, f }: { spec: Spec; f: Flow }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const art = renderAvatar(spec, 320, renderCtx(f, displayFont()));
    c.getContext("2d")!.drawImage(art, 0, 0);
  }, [spec, f.person, f.src, f.useCut, f.mode, f.first, f.last, f]);
  return <canvas ref={ref} width={320} height={320} aria-hidden="true" />;
}

export function GenStep(props: StepProps) {
  const { f, set, go } = props;
  const [err, setErr] = useState("");
  const picker = usePhotoPicker(props, setErr);
  const batch = f.batches[f.bi];
  const avatarMode = f.mode === "avatar";
  const note = f.useCut || avatarMode ? "" : f.styleNote;

  if (!batch) return null;

  function choose(spec: Spec) {
    const chosen: Spec = { ...spec, dx: 0, dy: 0, sz: 1 };
    set({ chosen, pic: makePic(renderAvatar(chosen, 1024, renderCtx(f, displayFont()))) });
    go("good");
  }

  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>Pick your favorite</h1>
      <p className="page-lede">Tap a picture to use it. Not feeling these? Refresh for ten new ones, and use the arrows to go back to earlier sets.</p>
      <div className="grid">
        {batch.map((spec, i) => (
          <button key={spec.seed} className="opt" type="button" aria-label={`Use picture option ${i + 1}`} onClick={() => choose(spec)}>
            <Thumb spec={spec} f={f} />
          </button>
        ))}
      </div>
      <div className="genbar">
        <button className="btn icon" type="button" aria-label="Previous set" disabled={f.bi === 0} onClick={() => set({ bi: f.bi - 1 })}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button className="btn primary" type="button" onClick={() => {
          const batches = [...f.batches, newBatch(f.style)].slice(-30);
          set({ batches, bi: batches.length - 1 });
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 6.1" /><path d="M20 4v7h-7" /></svg>Refresh
        </button>
        <button className="btn icon" type="button" aria-label="Next set" disabled={f.bi === f.batches.length - 1} onClick={() => set({ bi: f.bi + 1 })}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <p className="setlabel">Set {f.bi + 1} of {f.batches.length}</p>
      <p className="err" role="alert">{err || note}</p>
      <div className="backrow">
        {f.person ? (
          <button className="linkbtn" type="button" onClick={() => set({ useCut: !f.useCut })}>
            {f.useCut ? "Cutout look off? Keep my original background" : "Remove my background again"}
          </button>
        ) : null}
        {!avatarMode ? <button className="linkbtn" type="button" onClick={() => go("frame")}>Reposition my photo</button> : null}
        <button className="linkbtn" type="button" onClick={() => go("style")}>Change my style choices</button>
        {f.person && f.useCut ? <button className="linkbtn" type="button" onClick={() => go("touch")}>Touch up the cutout</button> : null}
        {!avatarMode ? <button className="linkbtn" type="button" onClick={() => picker.open("gen")}>Use a different photo</button> : null}
        <button className="linkbtn" type="button" onClick={() => go("picture")}>Upload my own picture instead</button>
      </div>
      {picker.field}
    </section>
  );
}
