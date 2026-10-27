"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CUTOUT_ENGINE } from "@/lib/env";
import { cloneCanvas, composePerson, cutOutPerson } from "@/lib/cutout";
import { makePic, type Crop, type Photo, type StepProps } from "../flow";
import { CROP_V, usePhotoPicker } from "./PictureStep";

const V = CROP_V;

function clamp(c: Crop, p: Photo): Crop {
  const dw = p.w * c.z, dh = p.h * c.z;
  return { ...c, ox: Math.min(0, Math.max(V - dw, c.ox)), oy: Math.min(0, Math.max(V - dh, c.oy)) };
}

function cropOut(p: Photo, c: Crop): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = out.height = 1024;
  const sw = V / c.z;
  out.getContext("2d")!.drawImage(p.img, -c.ox / c.z, -c.oy / c.z, sw, sw, 0, 0, 1024, 1024);
  return out;
}

export function FrameStep(props: StepProps) {
  const { f, set, go } = props;
  const photo = f.photo;
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const picker = usePhotoPicker(props, setErr);
  const crop = f.crop;

  useEffect(() => { if (!photo) go("picture"); }, [photo, go]);

  /* draw the photo, the dim outside of the circle, and the head guide */
  useEffect(() => {
    const c = cv.current;
    if (!c || !photo) return;
    const x = c.getContext("2d")!;
    x.clearRect(0, 0, V, V);
    x.drawImage(photo.img, crop.ox, crop.oy, photo.w * crop.z, photo.h * crop.z);
    x.save(); x.beginPath(); x.rect(0, 0, V, V); x.arc(V / 2, V / 2, V / 2 - 4, 0, Math.PI * 2, true);
    x.fillStyle = "rgba(43,37,34,.5)"; x.fill("evenodd"); x.restore();
    x.beginPath(); x.arc(V / 2, V / 2, V / 2 - 4, 0, Math.PI * 2); x.lineWidth = 5; x.strokeStyle = "#FFFFFF"; x.stroke();
    x.save(); x.beginPath(); x.ellipse(V / 2, V * 0.4, V * 0.19, V * 0.25, 0, 0, Math.PI * 2);
    x.setLineDash([14, 12]); x.lineWidth = 4; x.strokeStyle = "rgba(255,255,255,.95)"; x.stroke(); x.restore();
  }, [photo, crop]);

  const setZoomPct = useCallback((pct: number) => {
    if (!photo) return;
    set((s) => {
      const p = Math.max(100, Math.min(300, pct));
      const cx = (V / 2 - s.crop.ox) / s.crop.z, cy = (V / 2 - s.crop.oy) / s.crop.z;
      const z = s.crop.zmin * p / 100;
      return { crop: clamp({ ...s.crop, z, ox: V / 2 - cx * z, oy: V / 2 - cy * z }, photo) };
    });
  }, [photo, set]);
  const pct = Math.round((crop.z / crop.zmin) * 100);

  /* the wheel needs a non-passive listener so the page does not scroll while zooming */
  const pctRef = useRef(pct);
  useEffect(() => { pctRef.current = pct; }, [pct]);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoomPct(pctRef.current - e.deltaY * 0.25); };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [setZoomPct]);

  if (!photo) return null;
  const move = (dx: number, dy: number) => set((s) => ({ crop: clamp({ ...s.crop, ox: s.crop.ox + dx, oy: s.crop.oy + dy }, photo) }));

  async function next() {
    if (!photo) return;
    const src = cropOut(photo, crop);
    if (f.mode === "own") {
      set({ src, person: null, pic: makePic(src), chosen: null });
      go("good");
      return;
    }
    setBusy(true);
    try {
      const r = await cutOutPerson(src, { engine: CUTOUT_ENGINE });
      if (r) {
        set({ src, alpha: r.alpha, alpha0: cloneCanvas(r.alpha), person: composePerson(src, r.alpha), useCut: true, styleNote: "" });
      } else {
        set({ src, person: null, alpha: null, alpha0: null, useCut: false,
          styleNote: "We couldn't separate you from the background in this photo, so your original background will show. Try repositioning, or a photo with a plainer background." });
      }
    } finally { setBusy(false); }
    go("style");
  }

  return (
    <section className="step center">
      <h1 className="page-heading" tabIndex={-1}>Position your photo</h1>
      <p className="page-lede">Drag to move, and use the slider to zoom. Fit your head inside the dashed oval, with your shoulders reaching the bottom of the circle.</p>
      <div className="cropwrap">
        <canvas ref={cv} className="cropCv" width={V} height={V} tabIndex={0}
          aria-label="Photo position preview. Drag, or use the arrow keys, to move your photo."
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* optional */ } }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const k = V / e.currentTarget.getBoundingClientRect().width;
            move((e.clientX - drag.current.x) * k, (e.clientY - drag.current.y) * k);
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => {
            const d = ({ ArrowLeft: [30, 0], ArrowRight: [-30, 0], ArrowUp: [0, 30], ArrowDown: [0, -30] } as Record<string, number[]>)[e.key];
            if (d) { e.preventDefault(); move(d[0], d[1]); }
          }} />
      </div>
      <div className="zoomrow"><label htmlFor="zoom">Zoom</label>
        <input id="zoom" type="range" min={100} max={300} value={pct} onChange={(e) => setZoomPct(+e.target.value)} /></div>
      {busy ? (
        <div className="busy" style={{ justifyContent: "center" }} role="status"><div className="spin" aria-hidden="true" />
          <span>Cutting you out of the background… the first time can take a little longer.</span></div>
      ) : (
        <div className="actions"><button className="btn primary" type="button" onClick={next}>Continue</button></div>
      )}
      <p className="err" role="alert">{err}</p>
      <div className="backrow"><button className="linkbtn" type="button" onClick={() => picker.open(f.mode === "gen" ? "gen" : "own")}>Choose a different photo</button></div>
      {picker.field}
    </section>
  );
}
