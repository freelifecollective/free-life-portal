import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseEditor } from "@/components/classroom/CourseAdmin";
import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";
import type { CourseRow, LessonRow } from "@/lib/classroom/types";

export const instant = false;
export const metadata = { title: "Edit course" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCoursePage(props: PageProps<"/admin/classroom/[courseId]">) {
  const { courseId } = await props.params;
  if (!UUID.test(courseId)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: ov }, { data: ls }] = await Promise.all([
    supabase.rpc("classroom_overview"),
    supabase.from("classroom_lessons").select("id, course_id, title, body, vimeo_id, vimeo_hash, sort, published").eq("course_id", courseId).order("sort").order("created_at"),
  ]);
  const course = ((ov ?? []) as CourseRow[]).find((c) => c.id === courseId);
  if (!course) notFound();
  return (
    <>
      <PageHeading lede="Change the course, add lessons and put them in order.">Edit course</PageHeading>
      <p style={{ margin: "-8px 0 16px" }}><Link className="linkbtn" href="/admin/classroom">← All courses</Link></p>
      <CourseEditor course={course} lessons={(ls ?? []) as LessonRow[]} />
    </>
  );
}
