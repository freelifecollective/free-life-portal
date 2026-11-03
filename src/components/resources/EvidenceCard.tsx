"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

/** One success story: picture, name, rank and story, with buttons to copy the story and download the picture. */
export function EvidenceCard({ name, rank, typeLabel, story, photo }: { name: string; rank: string; typeLabel: string; story: string; photo: string | null }) {
  const [msg, setMsg] = useState("");
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  async function copy() {
    try { await navigator.clipboard.writeText(`${name} (${rank})\n\n${story}`); say("Story copied ✓"); } catch { say("Could not copy. Select the story and copy it instead."); }
  }
  async function download() {
    if (!photo) return;
    try {
      const blob = await (await fetch(photo)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "picture"}.${blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"}`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { window.open(photo, "_blank", "noopener"); }
  }
  return (
    <li className="ev-card">
      <div className="ev-photo">{photo ? <img src={photo} alt={`${name}`} loading="lazy" /> : <span aria-hidden="true">✦</span>}</div>
      <div className="ev-body">
        <h3 className="ev-name" translate="no">{name}</h3>
        <p className="ev-meta"><span className="ev-rank" translate="no">{rank}</span><span className="doc-tag">{typeLabel}</span></p>
        <p className="ev-story" translate="no">{story}</p>
        <div className="ev-actions">
          <button type="button" className="btn small" onClick={copy}>Copy story</button>
          {photo ? <button type="button" className="btn small" onClick={download}>Download picture</button> : null}
          <span className="when" role="status">{msg}</span>
        </div>
      </div>
    </li>
  );
}
