"use client";

import { useEffect, useRef } from "react";

const COLOURS = ["#AB9080", "#C9A24B", "#F1E9DF", "#8C6F5E", "#FFFFFF", "#E3C9B6", "#D8B98E"];
type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number };

/** A quick full-screen burst of fireworks in the portal's colours, with the "Crushed it!" message. It closes by itself after a moment (or on a tap). */
export function Fireworks({ onClose }: { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t = window.setTimeout(onClose, 3000);
    const cv = canvas.current;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!cv || calm) return () => window.clearTimeout(t);
    const ctx = cv.getContext("2d");
    if (!ctx) return () => window.clearTimeout(t);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => { cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    window.addEventListener("resize", size);
    const parts: P[] = [];
    const burst = () => {
      const x = window.innerWidth * (0.15 + Math.random() * 0.7), y = window.innerHeight * (0.12 + Math.random() * 0.45);
      const main = COLOURS[Math.floor(Math.random() * COLOURS.length)], alt = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      const n = 70 + Math.floor(Math.random() * 30);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n, s = 1.5 + Math.random() * 4.2;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 70 + Math.random() * 40, c: Math.random() < 0.7 ? main : alt, r: 1.6 + Math.random() * 1.8 });
      }
    };
    let raf = 0, frame = 0;
    const tick = () => {
      frame++;
      if (frame === 1) { burst(); burst(); } else if (frame % 16 === 0) burst();
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++; p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.05; p.x += p.vx; p.y += p.vy;
        const a = Math.max(0, 1 - p.life / p.max);
        if (a <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.shadowBlur = 10; ctx.shadowColor = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + a * 0.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); window.clearTimeout(t); };
  }, [onClose]);

  return (
    <div className="party" role="dialog" aria-modal="true" aria-label="You cleared your to-do list" onClick={onClose}>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="party-card">
        <p className="party-title">Crushed it!</p>
        <p className="party-sub">You cleared your to-do list 🙌</p>
      </div>
    </div>
  );
}
