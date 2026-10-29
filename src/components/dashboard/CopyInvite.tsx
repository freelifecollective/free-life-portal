"use client";

import { useState } from "react";

/** Copies the member's own landing page address, ready to send to a lead. */
export function CopyInvite({ username }: { username: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    const link = `${window.location.origin}/${username}`;
    try { await navigator.clipboard.writeText(link); setState("copied"); }
    catch { setState("failed"); window.prompt("Copy your invite link:", link); }
    window.setTimeout(() => setState("idle"), 2500);
  }
  return <button type="button" className="btn primary" onClick={copy}>{state === "copied" ? "Link copied ✓" : "Copy my invite link"}</button>;
}
