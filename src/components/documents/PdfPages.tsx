"use client";

import { useEffect, useRef, useState } from "react";

/** Shows every page of a PDF one under the other, so people can scroll through it without downloading anything. Pages are drawn as they come into view. */
export function PdfPages({ url, title }: { url: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; pages: number }>({ status: "loading", pages: 0 });

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    let cancelled = false;
    let doc: { destroy?: () => unknown } | null = null;
    let observer: IntersectionObserver | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch");
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise;
        doc = pdf as unknown as { destroy?: () => unknown };
        if (cancelled) return;
        host.replaceChildren();
        const width = Math.max(280, host.clientWidth - 24);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rendered = new Set<number>();

        observer = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLDivElement;
            const n = Number(el.dataset.page);
            if (rendered.has(n)) continue;
            rendered.add(n);
            void (async () => {
              const page = await pdf.getPage(n);
              const base = page.getViewport({ scale: 1 });
              const vp = page.getViewport({ scale: (width / base.width) * dpr });
              const canvas = document.createElement("canvas");
              canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
              canvas.style.width = "100%"; canvas.style.height = "100%"; canvas.style.display = "block";
              const ctx = canvas.getContext("2d");
              if (!ctx || cancelled) return;
              ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
              if (!cancelled) el.replaceChildren(canvas);
            })();
          }
        }, { root: host, rootMargin: "600px 0px" });

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const holder = document.createElement("div");
          holder.className = "pdf-page";
          holder.dataset.page = String(n);
          holder.style.aspectRatio = `${base.width} / ${base.height}`;
          holder.setAttribute("aria-label", `Page ${n} of ${pdf.numPages}`);
          host.appendChild(holder);
          observer.observe(holder);
          if (cancelled) return;
        }
        setState({ status: "ready", pages: pdf.numPages });
      } catch {
        if (!cancelled) setState({ status: "error", pages: 0 });
      }
    })();

    return () => { cancelled = true; observer?.disconnect(); void doc?.destroy?.(); };
  }, [url]);

  return (
    <div>
      <div ref={box} className="pdf-pages" role="document" aria-label={title} />
      {state.status === "loading" ? <p className="when">Loading the pages…</p> : null}
      {state.status === "ready" ? <p className="when" style={{ margin: "6px 0 0" }}>{state.pages} {state.pages === 1 ? "page" : "pages"}. Scroll to read them all.</p> : null}
      {state.status === "error" ? <p className="err">We could not show this PDF here. Please try again{" "}or use the Download button.</p> : null}
    </div>
  );
}
