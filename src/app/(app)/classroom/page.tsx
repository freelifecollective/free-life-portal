import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import type { CourseRow } from "@/lib/classroom/types";

export const instant = false;
export const metadata = { title: "Classroom" };

export default async function ClassroomPage() {
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Classroom</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.rpc("classroom_overview");
  const courses = ((data ?? []) as CourseRow[]).filter((c) => c.published || session.profile.role === "admin");
  return (
    <>
      <PageHeading lede="Courses with video lessons to help you learn, grow and build. Tick lessons off as you go.">Classroom</PageHeading>
      {session.profile.role === "admin" ? <p style={{ margin: "-8px 0 16px" }}><Link className="btn small" href="/admin/classroom" style={{ textDecoration: "none" }}>Manage the classroom</Link></p> : null}
      {courses.length === 0 ? <section className="card-s" style={{ maxWidth: 640 }}><p style={{ margin: 0 }}>No courses are open yet. Check back soon.</p></section> : (
        <div className="cl-grid">
          {courses.map((c) => {
            const pct = c.lessons ? Math.round((c.done / c.lessons) * 100) : 0;
            return (
              <Link key={c.id} href={`/classroom/${c.id}`} className="card-s cl-card" style={{ textDecoration: "none", color: "inherit" }}>
                <h2 translate="no">{c.title}</h2>
                {c.description ? <p className="when" translate="no">{c.description}</p> : null}
                <div className="cl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
                <p className="when" style={{ margin: 0 }}>{c.lessons === 0 ? "No lessons yet" : `${c.done} of ${c.lessons} lessons done`}</p>
                {!c.published ? <span className="tag">Draft</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
