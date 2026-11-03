import Link from "next/link";
import { CourseView } from "@/components/classroom/CourseView";
import { PageHeading } from "@/components/PageHeading";
import { requireMember } from "@/lib/auth/guards";
import { isLaunchCourse } from "@/lib/classroom/launch";
import type { CourseRow } from "@/lib/classroom/types";

export const instant = false;
export const metadata = { title: "Business Launch Course" };

export default async function BusinessLaunchPage(props: PageProps<"/business-launch">) {
  const sp = await props.searchParams;
  const { session, supabase } = await requireMember();
  if (!supabase) return <><PageHeading>Business Launch Course</PageHeading><p className="page-lede">This needs the database.</p></>;
  const { data } = await supabase.rpc("classroom_overview");
  const course = ((data ?? []) as CourseRow[]).find((c) => isLaunchCourse(c.title) && (c.published || session.profile.role === "admin"));
  if (!course) {
    return (
      <>
        <PageHeading>Business Launch Course</PageHeading>
        <section className="card-s" style={{ maxWidth: 640 }}>
          <p style={{ margin: 0 }}>{session.profile.role === "admin"
            ? <>The Business Launch Course has not been set up yet. In <Link href="/admin/classroom">Manage courses</Link>, create a course whose name starts with &ldquo;Business Launch&rdquo; and it will appear here.</>
            : "The Business Launch Course is not open yet. Check back soon."}</p>
        </section>
      </>
    );
  }
  const asked = Array.isArray(sp.lesson) ? sp.lesson[0] : sp.lesson;
  return <CourseView courseId={course.id} asked={asked} basePath="/business-launch" placement="launch" admin />;
}
