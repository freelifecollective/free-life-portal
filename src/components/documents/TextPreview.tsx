"use client";

import { useEffect, useState } from "react";

const LIMIT = 200_000;

/** Plain text and CSV files, shown as text (the first 200 KB). */
export function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [cut, setCut] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error("fetch")))).then((t) => { if (live) { setCut(t.length > LIMIT); setText(t.slice(0, LIMIT)); } }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [url]);
  if (failed) return <p className="err">We could not show this file here.</p>;
  if (text === null) return <p className="when">Loading…</p>;
  return (
    <>
      <pre className="doc-text">{text}</pre>
      {cut ? <p className="when">Showing the first part of the file. Download it to see the rest.</p> : null}
    </>
  );
}
