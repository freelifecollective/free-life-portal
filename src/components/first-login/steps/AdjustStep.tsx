"use client";

import { useEffect, useRef } from "react";
import { renderAvatar } from "@/lib/avatar/render";
import { displayFont, renderCtx, type StepProps } from "../flow";

/** Drag yourself inside the border and make yourself a little bigger. */
export function AdjustStep({ f, set, goBack }: StepProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const c = f.chosen;

  useEffect(() => {
    const el = cv.current;
    if (!el || !c) return;
    el.getContext("2d")!.clearRect(0, 0, 640, 640);
    el.getContext("2d")!.drawImage(renderAvatar(c, 640, renderCtx(f, displayFont())), 0, 0);
  }, [c, f]);

  if (!c) return null;
  const nudge = (dx: number, dy: number) =>
    set((s) => s.chosen ? { chosen: { ...s.chosen, dx: Math.max(-0.25, Math.min(0.25, (s.chosen.dx ?? 0) + dx)), dy: Math.max(0, Math.min(0.35, (s.chosen.dy ?? 0) + dy)) } } : {});

  return (
    <section className="step final">
      <h1 className="page-heading" tabIndex={-1}>Position yourself</h1>
      <p className="page-lede">Drag yourself to where you&rsquo;d like to sit inside the border. Use the slider to make yourself a little bigger.</p>
      <div className="cropwrap">
        <canvas ref={cv} className="adjCv" width={640} height={640} tabIndex={0}
          aria-label="Picture position preview. Drag, or use the arrow keys, to move yourself inside the border."
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* optional */ } }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const w = e.currentTarget.getBoundingClientRect().width;
            nudge((e.clientX - drag.current.x) / w, (e.clientY - drag.current.y) / w);
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => {
            const d = ({ ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] } as Record<string, number[]>)[e.key];
            if (d) { e.preventDefault(); nudge(d[0], d[1]); }
          }} />
      </div>
      <div className="zoomrow"><label htmlFor="adjSize">Size</label>
        <input id="adjSize" type="range" min={100} max={150} value={Math.round((c.sz ?? 1) * 100)}
          onChange={(e) => set((s) => (s.chosen ? { chosen: { ...s.chosen, sz: +e.target.value / 100 } } : {}))} /></div>
      <div className="actions">
        <button className="btn primary" type="button" onClick={goBack}>Done</button>
        <button className="linkbtn" type="button" onClick={() => set((s) => (s.chosen ? { chosen: { ...s.chosen, dx: 0, dy: 0, sz: 1 } } : {}))}>Reset</button>
      </div>
    </section>
  );
}
