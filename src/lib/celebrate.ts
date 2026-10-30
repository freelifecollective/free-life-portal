/** Asks the page to play the fireworks for a new, higher rank. Works from any screen. */
export function celebrateRankUp(rank: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("flc-rank-up", { detail: rank }));
}
