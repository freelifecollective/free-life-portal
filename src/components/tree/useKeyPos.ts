"use client";

import { useSyncExternalStore } from "react";

export type KeyPos = "left" | "top" | "right" | "bottom";
export const KEY_POSITIONS: { id: KeyPos; label: string }[] = [{ id: "left", label: "Left" }, { id: "top", label: "Top" }, { id: "right", label: "Right" }, { id: "bottom", label: "Bottom" }];
const NAME = "flc_tree_key";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; };
const read = (): KeyPos => { try { const v = localStorage.getItem(NAME); return v === "top" || v === "right" || v === "bottom" ? v : "left"; } catch { return "left"; } };

/** Where the colour key sits on the chart. Left until you move it; your choice is remembered on this device. */
export function useKeyPos(): [KeyPos, (p: KeyPos) => void] {
  const pos = useSyncExternalStore(subscribe, read, () => "left" as KeyPos);
  const set = (p: KeyPos) => { try { localStorage.setItem(NAME, p); } catch { /* it still works until you leave the page */ } listeners.forEach((l) => l()); };
  return [pos, set];
}
