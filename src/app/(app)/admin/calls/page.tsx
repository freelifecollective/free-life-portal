import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { CallForm } from "@/components/admin/CallForm";
import { requireAdmin } from "@/lib/auth/guards";
import { AUDIENCE_LABEL, CALL_COLUMNS, KIND_LABEL, type Call } from "@/lib/calls/types";
import { formatInZone, nowMs } from "@/lib/time";
import { createCall } from "./actions";

export const instant = false;
export const metadata = { title: "Manage calls" };

type Row = Call & { registrations: { count: number }[] };

function CallList({ items }: { items: Row[] }) {
  return (
    <ul className="admin-list">
      {items.map((c) => (
        <li key={c.id}>
          <div>
            <strong>{c.title}</strong>{c.pinned ? <span className="tag tag-pin" style={{ marginLeft: 8 }}>Pinned</span> : null}
            <div className="muted-line">{formatInZone(new Date(c.starts_at))} · {KIND_LABEL[c.kind]} · {AUDIENCE_LABEL[c.audience]}
              {c.audience === "leads_open" ? ` · ${c.registrations?.[0]?.count ?? 0} registered` : ""}</div>
          </div>
          <Link className="linkbtn" href={`/admin/calls/${c.id}`}>Edit</Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminCallsPage() {
  const { supabase } = await requireAdmin();
  const now = nowMs();
  const { data } = await supabase.from("calls").select(CALL_COLUMNS + ", registrations(count)").order("starts_at", { ascending: false }).limit(60);
  const rows = ((data ?? []) as unknown as Row[]);
  const upcoming = rows.filter((c) => new Date(c.starts_at).getTime() + c.duration_minutes * 60_000 > now).reverse();
  const past = rows.filter((c) => !upcoming.includes(c));

  return (
    <>
      <PageHeading lede="Add the week's calls. Times are Eastern. Community calls are open to leads; masterclasses are for affiliates.">Manage calls</PageHeading>
      <section className="card-s" style={{ maxWidth: 680 }} aria-label="Add a call">
        <h2 className="qh" style={{ marginTop: 0 }}>Add a call</h2>
        <CallForm action={createCall} submitLabel="Add call" />
      </section>
      <h2 className="qh" style={{ marginTop: 36 }}>Upcoming</h2>
      {upcoming.length ? <CallList items={upcoming} /> : <p className="page-lede" style={{ marginBottom: 0 }}>Nothing scheduled.</p>}
      {past.length ? <><h2 className="qh" style={{ marginTop: 36 }}>Earlier</h2><CallList items={past} /></> : null}
    </>
  );
}
