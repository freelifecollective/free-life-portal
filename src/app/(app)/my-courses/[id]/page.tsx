import { notFound } from "next/navigation";
import { CourseBuilder } from "@/components/courses/CourseBuilder";
import { requirePlan } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "Edit course" };

type Props = PageProps<"/my-courses/[id]">;

export default async function EditCoursePage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { session, supabase } = await requirePlan(97);
  const [{ data: course }, { data: lessons }] = await Promise.all([
    supabase.from("member_courses").select("id, owner_id, title, slug, description, cover_url, price_cents, currency, published").eq("id", id).maybeSingle(),
    supabase.from("member_lessons").select("id, title, body, video_url, free_preview").eq("course_id", id).order("position"),
  ]);
  if (!course || course.owner_id !== session.user.id) notFound();
  return <CourseBuilder course={course} lessons={lessons ?? []} userId={session.user.id} username={session.profile.username ?? null} />;
}
