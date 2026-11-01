import { CourseList } from "@/components/classroom/CourseAdmin";
import { PageHeading } from "@/components/PageHeading";
import { requireAdmin } from "@/lib/auth/guards";
import type { CourseRow } from "@/lib/classroom/types";

export const instant = false;
export const metadata = { title: "Manage classroom" };

export default async function ManageClassroomPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("classroom_overview");
  return (
    <>
      <PageHeading lede="Build courses out of video lessons. Courses and lessons stay hidden until you tick “Show”.">Manage classroom</PageHeading>
      <CourseList courses={(data ?? []) as CourseRow[]} />
    </>
  );
}
