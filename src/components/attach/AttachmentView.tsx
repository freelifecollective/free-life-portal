"use client";

/* eslint-disable @next/next/no-img-element */

import { fmtSize, isImage } from "@/lib/chats/attach";

/** A picture shows in the message (tap to open it full size); any other file shows as a card you can open. */
export function AttachmentView({ url, name, type, size }: { url: string; name: string; type: string; size?: number | null }) {
  if (isImage(type)) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className="att-img"><img src={url} alt={name} loading="lazy" /></a>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="att-file" download={name}>
      <span className="att-icon" aria-hidden="true">{type === "application/pdf" ? "PDF" : "📄"}</span>
      <span className="att-meta"><b translate="no">{name}</b>{size ? <small>{fmtSize(size)}</small> : null}</span>
    </a>
  );
}
