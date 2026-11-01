import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import type { CourseRow } from "@/lib/classroom/types";

export const instant = false;
export const metadata = { title: "Courses" };

export default async function ClassroomPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Courses</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.rpc("classroom_overview");
  const courses = ((data ?? []) as CourseRow[]).filter((c) => c.published || session.profile.role === "admin");
  return (
    <>
      <PageHeading lede="Courses with video lessons to help you learn, grow and build. Tick lessons off as you go.">Courses</PageHeading>
      {session.profile.role === "admin" ? <p style={{ margin: "-8px 0 16px" }}><Link className="btn small" href="/admin/classroom" style={{ textDecoration: "none" }}>Manage courses</Link></p> : null}
      {courses.length === 0 ? <section className="card-s" style={{ maxWidth: 640 }}><p style={{ margin: 0 }}>No courses are open yet. Check back soon.</p></section> : (
        <ul className="doc-grid rec-grid">
          {courses.map((c) => {
            const pct = c.lessons ? Math.round((c.done / c.lessons) * 100) : 0;
            return (
              <li key={c.id} className="doc-card">
                <Link href={`/classroom/${c.id}`} className="doc-card-main">
                  {c.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="doc-cover" src={c.cover_url} alt="" loading="lazy" />
                  ) : <span className="doc-cover folder" aria-hidden="true">🎓</span>}
                  <span className="doc-card-name" translate="no">{c.title}</span>
                  {c.description ? <span className="when cl-desc" translate="no">{c.description}</span> : null}
                  <span className="cl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></span>
                  <span className="doc-tags"><span className="when">{c.lessons === 0 ? "No lessons yet" : `${c.done} of ${c.lessons} lessons done`}</span>{!c.published ? <span className="tag">Draft</span> : null}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
