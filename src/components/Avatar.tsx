"use client";

import { useSyncExternalStore } from "react";

export const PREVIEW_AVATAR_KEY = "flc_preview_avatar";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function readLocal(): string | null {
  try { return localStorage.getItem(PREVIEW_AVATAR_KEY); } catch { return null; /* storage may be blocked */ }
}

/** Profile picture. In preview mode the picture lives in this browser, so it is read from local storage. */
export function Avatar({ url, initials, size = 40, preview = false, label }: {
  url: string | null; initials: string; size?: number; preview?: boolean; label?: string;
}) {
  const local = useSyncExternalStore(subscribe, () => (preview ? readLocal() : null), () => null);
  const src = url ?? local;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className="avatar" style={style} src={src} alt={label ?? ""} width={size} height={size} />;
  return <span className="avatar" style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{initials}</span>;
}
