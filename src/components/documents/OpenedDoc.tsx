"use client";

import { isOfficeDoc } from "@/lib/documents/types";
import { PdfPages } from "./PdfPages";
import { TextPreview } from "./TextPreview";

/** One document, opened straight away (the same way it opens inside the Documents tab). */
export function OpenedDoc({ name, mime, view, download }: { name: string; mime: string; view?: string; download?: string }) {
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 960 }}>
      {view && mime === "application/pdf" ? <PdfPages url={view} title={name} /> : null}
      {view && mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="doc-img" src={view} alt={name} />
      ) : null}
      {view && mime.startsWith("video/") ? <video className="doc-img" src={view} controls controlsList={download ? undefined : "nodownload"} /> : null}
      {view && mime.startsWith("audio/") ? <audio src={view} controls controlsList={download ? undefined : "nodownload"} style={{ width: "100%" }} /> : null}
      {view && (mime === "text/plain" || mime === "text/csv") ? <TextPreview url={view} /> : null}
      {view && isOfficeDoc(mime) ? (
        <>
          <iframe className="doc-frame" src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(view)}`} title={name} />
          <p className="when" style={{ margin: 0 }}>Shown with Microsoft&rsquo;s free viewer. The layout can differ a little from the original, and very large files may not load. Download it to open it fully.</p>
        </>
      ) : null}
      {!view && download ? <p className="when" style={{ margin: 0 }}>This type of file cannot be previewed here. Use the Download button to open it on your device.</p> : null}
      <div className="rs-actions" style={{ margin: 0 }}>
        {!download && view ? <span className="when">View only</span> : null}
        {download ? <a className="btn primary" href={download} style={{ textDecoration: "none" }}>Download</a> : null}
      </div>
    </div>
  );
}
