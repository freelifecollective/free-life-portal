"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Tells the portal this person is here, about once a minute while the page is open and showing. It is what powers "online" and "last seen". */
export function PresenceBeat() {
  useEffect(() => {
    const supabase = createClient();
    const beat = () => { if (document.visibilityState === "visible") void supabase.rpc("touch_presence").then(({ error }) => { if (error) console.warn("Presence check-in failed:", error.message); }); };
    beat();
    const timer = window.setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", beat); };
  }, []);
  return null;
}
