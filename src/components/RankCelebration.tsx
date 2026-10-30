"use client";

import { useEffect, useState } from "react";
import { Fireworks } from "@/components/tasks/Fireworks";

/** Listens for a rank going up anywhere in the portal and plays the fireworks. Draws nothing the rest of the time. */
export function RankCelebration() {
  const [rank, setRank] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setRank(String((e as CustomEvent).detail ?? ""));
    window.addEventListener("flc-rank-up", on);
    return () => window.removeEventListener("flc-rank-up", on);
  }, []);
  return rank ? <Fireworks title="Rank up!" sub={`You are now a ${rank} 🙌`} onClose={() => setRank(null)} /> : null;
}
