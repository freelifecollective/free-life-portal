"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cloneCanvas } from "@/lib/cutout";
import type { StepProps } from "../flow";

const S = 512;

/** Safety net for the cutout: paint back what was cut off, or erase leftover background. */
export function TouchStep({ f, set, goBack }: StepProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const tmp = useRef<HTMLCanvasElement | null>(null);
  const undo = useRef<HTMLCanvasElement[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const painting = useRef(false);
  const [keep, setKeep] = useState(true);
  const [brush, setBrush] = useState(28);

  const draw = useCallback(() => {
    const c = cv.current, a = f.alpha, src = f.src;
    if (!c || !a || !src) return;
    if (!tmp.current) { tmp.current = document.createElement("canvas"); tmp.current.width = tmp.current.height = S; }
    const x = c.getContext("2d")!, t = tmp.current.getContext("2d")!;
    x.globalAlpha = 1; x.fillStyle = "#F6F5F1"; x.fillRect(0, 0, S, S);
    x.globalAlpha = 0.28; x.drawImage(src, 0, 0, S, S); x.globalAlpha = 1; /* faded = currently removed */
    t.globalCompositeOperation = "source-over"; t.clearRect(0, 0, S, S);
    t.drawImage(src, 0, 0, S, S);
    t.globalCompositeOperation = "destination-in"; t.drawImage(a, 0, 0);
    x.drawImage(tmp.current, 0, 0);
  }, [f.alpha, f.src]);
  useEffect(draw, [draw]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), k = S / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };
  function paintTo(p: { x: number; y: number }) {
    const a = f.alpha!.getContext("2d")!, q = last.current ?? p;
    a.save();
    a.globalCompositeOperation = keep ? "source-over" : "destination-out";
    a.lineCap = "round"; a.lineJoin = "round"; a.lineWidth = brush;
    a.strokeStyle = "#000"; a.shadowColor = "#000"; a.shadowBlur = 3;
    a.beginPath(); a.moveTo(q.x, q.y); a.lineTo(p.x + 0.01, p.y); a.stroke();
    a.restore();
    last.current = p;
    draw();
  }

  if (!f.alpha || !f.src) return null;
  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>Touch up your cutout</h1>
      <p className="page-lede">Paint over any part of you that got cut off to bring it back, or erase leftover background. The faded areas are what&rsquo;s currently removed.</p>
      <div className="cropwrap">
        <canvas ref={cv} className="touchCv" width={S} height={S} aria-label="Cutout touch-up canvas"
          onPointerDown={(e) => {
            e.preventDefault();
            undo.current.push(cloneCanvas(f.alpha!)); if (undo.current.length > 20) undo.current.shift();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* optional */ }
            last.current = null; painting.current = true; paintTo(point(e));
          }}
          onPointerMove={(e) => { if (painting.current) paintTo(point(e)); }}
          onPointerUp={() => { painting.current = false; last.current = null; }}
          onPointerCancel={() => { painting.current = false; last.current = null; }} />
      </div>
      <div className="tools" role="group" aria-label="Brush mode">
        <button className={"btn tool" + (keep ? " on" : "")} type="button" aria-pressed={keep} onClick={() => setKeep(true)}>Bring back</button>
        <button className={"btn tool" + (!keep ? " on" : "")} type="button" aria-pressed={!keep} onClick={() => setKeep(false)}>Erase</button>
      </div>
      <div className="zoomrow"><label htmlFor="brush">Brush size</label>
        <input id="brush" type="range" min={6} max={70} value={brush} onChange={(e) => setBrush(+e.target.value)} /></div>
      <div className="actions">
        <button className="btn primary" type="button" onClick={goBack}>Done</button>
        <button className="linkbtn" type="button" onClick={() => { const u = undo.current.pop(); if (u) set({ alpha: u }); }}>Undo</button>
        <button className="linkbtn" type="button" onClick={() => { undo.current.push(cloneCanvas(f.alpha!)); set({ alpha: cloneCanvas(f.alpha0!) }); }}>Reset</button>
      </div>
    </section>
  );
}
