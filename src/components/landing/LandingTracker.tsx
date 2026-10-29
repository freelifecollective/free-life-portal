"use client";

import { useEffect } from "react";
import { trackLanding } from "@/app/[username]/actions";

const KEY = "flc_visitor";

/** A random, anonymous id for this browser, so a visitor is counted once however often they come back. */
function visitorId(): string {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) { v = crypto.randomUUID().replace(/-/g, ""); localStorage.setItem(KEY, v); }
    return v;
  } catch { return crypto.randomUUID().replace(/-/g, ""); }
}

/** Counts this page's visits and taps on its "save my spot" buttons for the member who owns it. Nothing is shown. */
export function LandingTracker({ username, skip }: { username: string; skip: boolean }) {
  useEffect(() => {
    if (skip) return;
    const id = visitorId();
    void trackLanding(username, "visit", id);
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('a[href="#join"]')) void trackLanding(username, "click", id);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [username, skip]);
  return null;
}
