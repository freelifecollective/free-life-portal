"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Layout } from "@/lib/graphics/layout";
import { renderGraphic, type GraphicData } from "@/lib/graphics/render";

/** The finished picture, drawn live. The canvas is the real size of the template; it is shown scaled to fit. */
export const GraphicCanvas = forwardRef<HTMLCanvasElement | null, { bgUrl: string; layout: Layout; data: GraphicData }>(function GraphicCanvas({ bgUrl, layout, data }, ref) {
  const el = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => el.current as HTMLCanvasElement);
  const key = JSON.stringify([bgUrl, layout, data]);
  useEffect(() => {
    let live = true;
    const c = el.current;
    if (c) void renderGraphic(c, bgUrl, layout, data).then(() => { if (!live) return; });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <canvas ref={el} className="gm-canvas" aria-label="Your picture" />;
});
