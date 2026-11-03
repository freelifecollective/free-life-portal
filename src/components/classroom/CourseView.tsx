import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/classroom/LessonView";
import { PageHeading } from "@/components/PageHeading";
import { PlacedDocs } from "@/components/documents/PlacedDocs";
import { requireMember } from "@/lib/auth/guards";
import type { CourseRow, LessonRow } from "@/lib/classroom/types";

/** One course with its lessons. Used for every course, and for the Business Launch Course tab (which has its own address). */
export async function CourseView({ courseId, asked, basePath, back, placement, admin }: { courseId: string; asked?: string; basePath: string; back?: { href: string; label: string }; placement: string; admin?: boolean }) {
  const { session, supabase } = await requireMember();
  if (!supabase) notFound();
  const [{ data: ov }, { data: ls }, { data: pr }] = await Promise.all([
    supabase.rpc("classroom_overview"),
    supabase.from("classroom_lessons").select("id, course_id, title, body, vimeo_id, vimeo_hash, sort, published").eq("course_id", courseId).order("sort").order("created_at"),
    supabase.from("classroom_progress").select("lesson_id").eq("user_id", session.user.id),
  ]);
  const course = ((ov ?? []) as CourseRow[]).find((c) => c.id === courseId);
  if (!course) notFound();
  const isAdmin = session.profile.role === "admin";
  const lessons = ((ls ?? []) as LessonRow[]).filter((l) => l.published || isAdmin);
  const done = new Set(((pr ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id));
  const current = lessons.find((l) => l.id === asked) ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0] ?? null;
  const idx = current ? lessons.indexOf(current) : -1;
  const next = idx >= 0 ? lessons[idx + 1] ?? null : null;
  return (
    <>
      <PageHeading lede={course.description ?? undefined}><span translate="no">{course.title}</span></PageHeading>
      <PlacedDocs placement={placement} />
      {back ? <p style={{ margin: "-8px 0 16px" }}><Link className="linkbtn" href={back.href}>{back.label}</Link></p> : null}
      {admin && isAdmin ? <p style={{ margin: "-8px 0 16px" }}><Link className="btn small" href={`/admin/classroom/${courseId}`} style={{ textDecoration: "none" }}>Edit this course</Link></p> : null}
      {lessons.length === 0 || !current ? <section className="card-s" style={{ maxWidth: 640 }}><p style={{ margin: 0 }}>There are no lessons in this course yet.</p></section> : (
        <div className="cl-layout">
          <nav className="cl-list" aria-label="Lessons">
            <ol>
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <Link href={`${basePath}?lesson=${l.id}`} aria-current={l.id === current.id ? "page" : undefined} className={done.has(l.id) ? "done" : undefined}>
                    <span className="cl-num" aria-hidden="true">{done.has(l.id) ? "✓" : i + 1}</span><span translate="no">{l.title}</span>{!l.published ? <small className="tag">Draft</small> : null}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <LessonView key={current.id} lesson={current} courseId={courseId} done={done.has(current.id)} nextId={next?.id ?? null} nextTitle={next?.title ?? null} basePath={basePath} />
        </div>
      )}
    </>
  );
}
