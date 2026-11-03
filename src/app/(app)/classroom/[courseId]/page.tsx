import { notFound } from "next/navigation";
import { CourseView } from "@/components/classroom/CourseView";

export const instant = false;
export const metadata = { title: "Courses" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CoursePage(props: PageProps<"/classroom/[courseId]">) {
  const { courseId } = await props.params;
  const sp = await props.searchParams;
  if (!UUID.test(courseId)) notFound();
  const asked = Array.isArray(sp.lesson) ? sp.lesson[0] : sp.lesson;
  return <CourseView courseId={courseId} asked={asked} basePath={`/classroom/${courseId}`} back={{ href: "/classroom", label: "← All courses" }} placement="courses" />;
}
