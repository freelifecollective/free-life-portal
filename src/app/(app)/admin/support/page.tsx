import { PageHeading } from "@/components/PageHeading";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireAdmin } from "@/lib/auth/guards";
import { KIND_LABEL, type ResourceKind } from "@/lib/support/types";
import { removeResource } from "./actions";

export const instant = false;
export const metadata = { title: "Weekly Focus library" };

type Res = { id: string; kind: ResourceKind; title: string; url: string | null; description: string | null; keywords: string | null; for_leads: boolean; for_downline: boolean };
type Need = { label: string; kind: "theme" | "word"; asked: number; nothing_found: number };

export default async function SupportAdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: res }, { data: qs }] = await Promise.all([
    supabase.from("support_resources").select("id, kind, title, url, description, keywords, for_leads, for_downline").order("created_at", { ascending: false }).limit(300),
    supabase.rpc("support_suggestions"),
  ]);
  const list = (res ?? []) as unknown as Res[];
  const needs = (qs ?? []) as Need[];
  return (
    <>
      <PageHeading lede="Books, websites and other resources people are pointed to when they say what they want to work on. Calls, recordings, lessons and documents are suggested automatically.">Weekly Focus library</PageHeading>
      <section className="card-s" style={{ maxWidth: 680 }}>
        <h2 className="qh" style={{ marginTop: 0 }}>Add a resource</h2>
        <ResourceForm />
      </section>

      <h2 className="qh" style={{ marginTop: 36 }}>In the library ({list.length})</h2>
      {list.length === 0 ? <p className="page-lede">Nothing yet.</p> : (
        <ul className="admin-list">
          {list.map((r) => (
            <li key={r.id}>
              <div><strong>{r.title}</strong> <span className="doc-tag">{KIND_LABEL[r.kind]}</span>
                <div className="muted-line">{[r.url, r.description, r.keywords ? `finds: ${r.keywords}` : null, r.for_leads ? "leads" : null, r.for_downline ? "downline" : null].filter(Boolean).join(" · ")}</div></div>
              <form action={removeResource}><input type="hidden" name="id" value={r.id} /><button className="linkbtn" type="submit">Remove</button></form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="qh" style={{ marginTop: 36 }}>Needs that keep coming up</h2>
      <p className="page-lede" style={{ marginTop: -6 }}>Anonymous. Only things asked at least three times in the last three months, as counts: no names and no one&apos;s actual questions are ever kept. Ones that often found nothing are the gaps to fill, with a resource, a recording or a lesson.</p>
      {needs.length === 0 ? <p className="page-lede">Nothing has come up often enough yet.</p> : (
        <ul className="admin-list">
          {needs.map((n) => (
            <li key={n.kind + n.label}>
              <div><strong style={{ color: n.nothing_found > 0 ? "var(--bad, #c0261c)" : undefined }}>{n.label}</strong> <span className="doc-tag">{n.kind === "theme" ? "Situation" : "Word"}</span>
                <div className="muted-line">{`Asked ${n.asked} times · found nothing ${n.nothing_found} ${n.nothing_found === 1 ? "time" : "times"}`}</div></div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
