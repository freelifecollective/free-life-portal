import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/classroom/LessonView";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import type { CourseRow, LessonRow } from "@/lib/classroom/types";

export const instant = false;
export const metadata = { title: "Classroom" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CoursePage(props: PageProps<"/classroom/[courseId]">) {
  const { courseId } = await props.params;
  const sp = await props.searchParams;
  if (!UUID.test(courseId)) notFound();
  const { session, supabase } = await requireMember();
  if (!supabase) notFound();
  const [{ data: ov }, { data: ls }, { data: pr }] = await Promise.all([
    supabase.rpc("classroom_overview"),
    supabase.from("classroom_lessons").select("id, course_id, title, body, vimeo_id, vimeo_hash, sort, published").eq("course_id", courseId).order("sort").order("created_at"),
    supabase.from("classroom_progress").select("lesson_id").eq("user_id", session.user.id),
  ]);
  const course = ((ov ?? []) as CourseRow[]).find((c) => c.id === courseId);
  if (!course) notFound();
  const lessons = ((ls ?? []) as LessonRow[]).filter((l) => l.published || session.profile.role === "admin");
  const done = new Set(((pr ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id));
  const asked = Array.isArray(sp.lesson) ? sp.lesson[0] : sp.lesson;
  const current = lessons.find((l) => l.id === asked) ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0] ?? null;
  const idx = current ? lessons.indexOf(current) : -1;
  const next = idx >= 0 ? lessons[idx + 1] ?? null : null;
  return (
    <>
      <PageHeading lede={course.description ?? undefined}><span translate="no">{course.title}</span></PageHeading>
      <p style={{ margin: "-8px 0 16px" }}><Link className="linkbtn" href="/classroom">← All courses</Link></p>
      {lessons.length === 0 || !current ? <section className="card-s" style={{ maxWidth: 640 }}><p style={{ margin: 0 }}>There are no lessons in this course yet.</p></section> : (
        <div className="cl-layout">
          <nav className="cl-list" aria-label="Lessons">
            <ol>
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <Link href={`/classroom/${courseId}?lesson=${l.id}`} aria-current={l.id === current.id ? "page" : undefined} className={done.has(l.id) ? "done" : undefined}>
                    <span className="cl-num" aria-hidden="true">{done.has(l.id) ? "✓" : i + 1}</span><span translate="no">{l.title}</span>{!l.published ? <small className="tag">Draft</small> : null}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <LessonView key={current.id} lesson={current} courseId={courseId} done={done.has(current.id)} nextId={next?.id ?? null} nextTitle={next?.title ?? null} />
        </div>
      )}
    </>
  );
}
