import { PageHeading } from "@/components/PageHeading";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireAdmin } from "@/lib/auth/guards";
import { KIND_LABEL, type ResourceKind } from "@/lib/support/types";
import { clearQuestion, removeResource } from "./actions";

export const instant = false;
export const metadata = { title: "Weekly Focus library" };

type Res = { id: string; kind: ResourceKind; title: string; url: string | null; description: string | null; keywords: string | null; for_leads: boolean; for_downline: boolean };
type Q = { id: string; question: string; found: number; created_at: string; profiles: { first_name: string | null; last_name: string | null } | null };
const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default async function SupportAdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: res }, { data: qs }] = await Promise.all([
    supabase.from("support_resources").select("id, kind, title, url, description, keywords, for_leads, for_downline").order("created_at", { ascending: false }).limit(300),
    supabase.from("support_questions").select("id, question, found, created_at, profiles(first_name, last_name)").order("created_at", { ascending: false }).limit(60),
  ]);
  const list = (res ?? []) as unknown as Res[];
  const asked = (qs ?? []) as unknown as Q[];
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

      <h2 className="qh" style={{ marginTop: 36 }}>What people are working on</h2>
      <p className="page-lede" style={{ marginTop: -6 }}>The latest things typed in. Ones with no matches show in red: those are the gaps to fill.</p>
      {asked.length === 0 ? <p className="page-lede">Nobody has asked yet.</p> : (
        <ul className="admin-list">
          {asked.map((a) => (
            <li key={a.id}>
              <div><strong style={{ color: a.found === 0 ? "var(--bad, #c0261c)" : undefined }}>{a.question}</strong>
                <div className="muted-line">{[a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || "A member"} · {when(a.created_at)} · {a.found} {a.found === 1 ? "match" : "matches"}</div></div>
              <form action={clearQuestion}><input type="hidden" name="id" value={a.id} /><button className="linkbtn" type="submit">Clear</button></form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
