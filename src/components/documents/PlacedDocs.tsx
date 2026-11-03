import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { docTypeLabel } from "@/lib/documents/types";

type Doc = { id: string; name: string; mime: string; thumb_path: string | null; doc_type: string; sub_path: string };

/** The documents set to show on this page: cards below the subtitle, then a divider before the rest of the page. Nothing appears when there are none. */
export async function PlacedDocs({ placement }: { placement: string }) {
  const supabase = await createClient();
  const [{ data }, { data: fl }] = await Promise.all([supabase.rpc("placed_documents", { p_placement: placement }), supabase.rpc("placed_folders", { p_placement: placement })]);
  const docs = (data ?? []) as Doc[];
  const folders = (fl ?? []) as { id: string; name: string }[];
  if (docs.length === 0 && folders.length === 0) return null;
  const withThumbs = docs.filter((d) => d.thumb_path);
  const urls: Record<string, string> = {};
  if (withThumbs.length) {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrls(withThumbs.map((d) => d.thumb_path!), 3600);
    (signed ?? []).forEach((s, i) => { if (s.signedUrl) urls[withThumbs[i].id] = s.signedUrl; });
  }
  const card = (d: Doc) => {
    const ext = d.name.includes(".") ? d.name.split(".").pop()!.slice(0, 4).toUpperCase() : "FILE";
    const icon = d.mime.startsWith("audio/") ? "🎧" : d.mime.startsWith("video/") ? "🎬" : d.mime.includes("sheet") || d.mime.includes("excel") ? "📊" : d.mime.includes("presentation") || d.mime.includes("powerpoint") ? "📽️" : d.mime.includes("pdf") ? "📄" : "📎";
    return (
      <li key={d.id} className="doc-card">
        <Link href={`/documents/open/${d.id}`} className="doc-card-main">
          {urls[d.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="doc-cover" src={urls[d.id]} alt="" loading="lazy" />
          ) : <span className="doc-cover fallback"><span aria-hidden="true">{icon}</span><b>{ext}</b></span>}
          <span className="doc-card-name" translate="no">{d.name}</span>
          <span className="doc-tags"><span className="doc-tag">{docTypeLabel(d.doc_type)}</span></span>
        </Link>
      </li>
    );
  };
  return (
    <section className="placed-docs" aria-label="Documents">
      <ul className="doc-grid sup-docs">
        {folders.map((f) => (
          <li key={f.id} className="doc-card">
            <Link href={`/documents?f=${f.id}`} className="doc-card-main">
              <span className="doc-cover folder" aria-hidden="true">📁</span>
              <span className="doc-card-name" translate="no">{f.name}</span>
            </Link>
          </li>
        ))}
        {docs.map(card)}
      </ul>
      <hr className="placed-divider" />
    </section>
  );
}
