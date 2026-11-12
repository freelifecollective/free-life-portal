import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { NewCourse } from "@/components/courses/CourseBuilder";
import { requirePlan } from "@/lib/auth/guards";

export const instant = false;
export const metadata = { title: "My Courses" };

/** Builder and Leader: courses of their own, to sell outside of Enagic. */
export default async function MyCoursesPage() {
  const { session, supabase } = await requirePlan(97);
  const { data } = await supabase.from("member_courses").select("id, title, slug, published, price_cents, currency, member_lessons(count)").eq("owner_id", session.user.id).order("updated_at", { ascending: false });
  const courses = (data ?? []) as { id: string; title: string; slug: string; published: boolean; price_cents: number | null; currency: string; member_lessons: { count: number }[] }[];
  return (
    <>
      <PageHeading lede="Create your own courses and sell them outside of Enagic. Payments go straight to your own Stripe or PayPal account.">My Courses</PageHeading>
      <div className="mc">
        <NewCourse />
        {courses.length === 0 ? <p className="when">You have not made a course yet.</p> : (
          <ul className="mv-list">
            {courses.map((c) => (
              <li key={c.id} className="mv-item">
                <div className="mv-text">
                  <b translate="no">{c.title}</b>
                  <span>{`${c.member_lessons?.[0]?.count ?? 0} lessons · ${c.price_cents ? `${(c.price_cents / 100).toFixed(2)} ${c.currency.toUpperCase()}` : "No price yet"} · ${c.published ? "Published" : "Draft"}`}</span>
                </div>
                <div className="mv-actions">
                  <Link className="btn primary small" href={`/my-courses/${c.id}`}>Edit</Link>
                  {c.published && session.profile.username ? <a className="btn small" href={`/c/${session.profile.username}/${c.slug}`} target="_blank" rel="noopener noreferrer">Open</a> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
