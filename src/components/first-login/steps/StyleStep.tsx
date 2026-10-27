"use client";

import { useEffect, useRef } from "react";
import { EXAMPLES, newBatch, type BackgroundChoice, type OutlineChoice } from "@/lib/avatar/palettes";
import { renderAvatar } from "@/lib/avatar/render";
import { displayFont, renderCtx, type Flow, type StepProps } from "../flow";

type Example = OutlineChoice | BackgroundChoice;

/** A small preview that uses the member's own photo (or initials) so they can see what each choice does. */
function ExampleCanvas({ kind, f }: { kind: Example; f: Flow }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const e = EXAMPLES[kind];
    const art = renderAvatar({ seed: 11, pal: 0, back: e.back, tone: 0, filter: "none", it: false, ring: e.ring, zoom: 1.02 }, 240, renderCtx(f, displayFont()));
    const x = c.getContext("2d")!;
    x.clearRect(0, 0, 240, 240);
    x.drawImage(art, 0, 0);
  }, [kind, f]);
  return <canvas ref={ref} width={240} height={240} aria-hidden="true" />;
}

function Group<T extends string>({ id, label, value, onPick, items }: {
  id: string; label: string; value: T | null; onPick: (v: T) => void;
  items: { v: T; title: string; hint: string; node: React.ReactNode }[];
}) {
  return (
    <>
      <h2 className="qh" id={id}>{label}</h2>
      <div className="opts3" role="radiogroup" aria-labelledby={id}>
        {items.map((it) => (
          <button key={it.v} type="button" role="radio" aria-checked={value === it.v} className="sopt" onClick={() => onPick(it.v)}>
            {it.node}<span>{it.title}</span><small>{it.hint}</small>
          </button>
        ))}
      </div>
    </>
  );
}

export function StyleStep({ f, set, go }: StepProps) {
  const ready = Boolean(f.style.outline && f.style.bg);
  return (
    <section className="step">
      <h1 className="page-heading" tabIndex={-1}>Let&rsquo;s style your picture</h1>
      <p className="page-lede">Choose one option in each section and we&rsquo;ll create ten pictures just for you.</p>
      {f.styleNote ? <p className="err">{f.styleNote}</p> : null}
      <Group<OutlineChoice> id="qh1" label="1. Choose your outline" value={f.style.outline} onPick={(v) => set((s) => ({ style: { ...s.style, outline: v } }))}
        items={[
          { v: "outline", title: "Outline", hint: "A clean ring around the edge", node: <ExampleCanvas kind="outline" f={f} /> },
          { v: "fancy", title: "Fancy outline", hint: "Sparkles, beads, scallops and more", node: <ExampleCanvas kind="fancy" f={f} /> },
          { v: "none", title: "No outline", hint: "Just you and the backdrop", node: <ExampleCanvas kind="none" f={f} /> },
        ]} />
      <Group<BackgroundChoice> id="qh2" label="2. Choose your background" value={f.style.bg} onPick={(v) => set((s) => ({ style: { ...s.style, bg: v } }))}
        items={[
          { v: "texture", title: "Texture", hint: "Soft gradients, waves and blobs", node: <ExampleCanvas kind="texture" f={f} /> },
          { v: "print", title: "Print", hint: "Dots, grids, rings and stripes", node: <ExampleCanvas kind="print" f={f} /> },
          { v: "solid", title: "Solid", hint: "One flat colour", node: <ExampleCanvas kind="solid" f={f} /> },
        ]} />
      <div className="actions">
        <button className="btn primary" type="button" disabled={!ready} onClick={() => { set((s) => ({ batches: [newBatch(s.style)], bi: 0 })); go("gen"); }}>Create my pictures</button>
      </div>
    </section>
  );
}
