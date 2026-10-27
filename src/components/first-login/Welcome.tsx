"use client";

import { useEffect, useRef } from "react";

const BG = "#F6F5F1";
const FADE_IN = 1;
const END = 1 + 0 + 1.45; // fade in, hold, hyperspace
const smooth = (t: number) => t * t * (3 - 2 * t);

type Props = {
  /** the first question starts fading in beneath the intro */
  onReveal: () => void;
  /** the intro is gone */
  onFinish: () => void;
};

/**
 * "Welcome to the Free Life Collective". Text fades in over 1 s while stars drift; around 2 s the stars and
 * text snap to hyperspace; by about 2.3 s both are gone and the first question fades in over 2 s.
 */
export function Welcome({ onReveal, onFinish }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const tx = useRef<HTMLHeadingElement>(null);
  const reveal = useRef(onReveal);
  const finish = useRef(onFinish);
  useEffect(() => { reveal.current = onReveal; finish.current = onFinish; });
  const skip = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = cv.current!, text = tx.current!, root = wrap.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, timer = 0, active = true, revealed = false, W = 0, H = 0;

    const doReveal = () => { if (!revealed) { revealed = true; root.style.pointerEvents = "none"; reveal.current(); } };
    const done = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf); clearTimeout(timer);
      window.removeEventListener("resize", size);
      doReveal();
      root.hidden = true;
      finish.current();
    };
    skip.current = done;

    function size() {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * d; canvas.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    }

    if (reduce) {
      text.style.opacity = "1"; root.style.background = BG;
      timer = window.setTimeout(done, 3500);
      return () => { active = false; clearTimeout(timer); };
    }

    size();
    window.addEventListener("resize", size);
    const stars = Array.from({ length: 360 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 0.95 + 0.05 }));
    let t0: number | null = null, last = 0;

    const frame = (ts: number) => {
      if (!active) return;
      if (t0 === null) { t0 = ts; last = ts; }
      const t = (ts - t0) / 1000, dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const h = Math.min(t / 3, 1);
      const sc = 0.8 * Math.exp(t < 2 ? 0.35 * t : 0.7 + 10.5 * (t - 2));
      const op = smooth(Math.min(t / FADE_IN, 1)) * (t > 2.1 ? 1 - smooth(Math.min((t - 2.1) / 0.2, 1)) : 1);
      if (t >= 2.1) doReveal();
      /* the whole hyperspace layer fades out while the first question fades in beneath it */
      canvas.style.opacity = String(t >= 2.1 ? 1 - smooth(Math.min((t - 2.1) / 0.3, 1)) : 1);
      text.style.opacity = op.toFixed(3);
      text.style.transform = `scale(${sc.toFixed(3)})`;
      /* background plain until the zoom begins, then stars gather speed */
      ctx.fillStyle = h > 0.7 ? BG : "rgba(246,245,241,0.34)";
      ctx.fillRect(0, 0, W, H);
      if (h > 0) {
        const v = t < 2 ? 0.5 : 15;
        const cx = W / 2, cy = H / 2, k = Math.max(W, H) * 0.18;
        for (const s of stars) {
          s.z -= v * dt;
          if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = v > 6 ? 0.05 + Math.random() * 0.95 : 1; }
          const pz = Math.min(1.25, s.z + Math.max(v * 0.01, 0.03));
          ctx.strokeStyle = `rgba(171,144,128,${(1 - s.z * 0.55).toFixed(3)})`;
          ctx.lineWidth = 0.6 + (1 - s.z) * 0.9;
          ctx.beginPath();
          ctx.moveTo(cx + (s.x / pz) * k, cy + (s.y / pz) * k);
          ctx.lineTo(cx + (s.x / s.z) * k, cy + (s.y / s.z) * k);
          ctx.stroke();
        }
      }
      if (t >= END) { done(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { active = false; cancelAnimationFrame(raf); clearTimeout(timer); window.removeEventListener("resize", size); };
  }, []);

  return (
    <div className="fl-welcome" ref={wrap} role="presentation">
      <canvas ref={cv} aria-hidden="true" />
      <h1 ref={tx}><span className="wl">Welcome to the</span> <em>Free Life Collective</em></h1>
      <button className="skip" type="button" onClick={() => skip.current()}>Skip intro</button>
    </div>
  );
}
