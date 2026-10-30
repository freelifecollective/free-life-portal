"use client";

import { useEffect, useRef } from "react";
import { BadgeMedal, labelFor } from "./BadgeMedal";

/** A small "you earned a badge" card at the bottom of the screen. It goes by itself after a few seconds. */
export function BadgeToast({ keys, onClose }: { keys: string[]; onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => { const t = window.setTimeout(() => close.current(), 7000); return () => window.clearTimeout(t); }, []);
  const first = keys[0];
  const l = first ? labelFor(first) : null;
  if (!first || !l) return null;
  return (
    <div className="badge-toast" role="status" onClick={onClose}>
      <BadgeMedal id={first} size={64} />
      <div>
        <strong>New badge{keys.length > 1 ? `s (${keys.length})` : ""}!</strong>
        <span>{l.level}</span>
        <small>{l.title}{keys.length > 1 ? ` and ${keys.length - 1} more` : ""}</small>
      </div>
    </div>
  );
}
