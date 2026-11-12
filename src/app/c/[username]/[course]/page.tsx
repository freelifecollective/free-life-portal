import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Props = PageProps<"/c/[username]/[course]">;
type Course = { title: string; description: string | null; cover_url: string | null; price_cents: number | null; currency: string; owner_first_name: string; owner_last_name: string | null; owner_photo: string | null; lessons: { title: string; free_preview: boolean; body: string | null; video_url: string | null }[] };

async function load(params: Props["params"]): Promise<Course | null> {
  const { username, course } = await params;
  if (!supabaseConfigured || !/^[a-z0-9_-]{3,30}$/i.test(username) || !/^[a-z0-9-]{1,50}$/.test(course)) return null;
  const { data } = await (await createClient()).rpc("public_member_course", { p_username: username, p_slug: course });
  return (data as Course | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load(params);
  return { title: c ? c.title : "Course not found" };
}

/** A member's course, as anyone sees it: what it teaches, its price, its lessons (free-preview lessons in full). */
export default async function CoursePage({ params }: Props) {
  const c = await load(params);
  if (!c) notFound();
  const by = [c.owner_first_name, c.owner_last_name].filter(Boolean).join(" ");
  const price = c.price_cents ? new Intl.NumberFormat("en-US", { style: "currency", currency: c.currency.toUpperCase() }).format(c.price_cents / 100) : null;
  return (
    <main className="cp">
      <header className="cp-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.cover_url ? <img className="cp-cover" src={c.cover_url} alt="" /> : null}
        <div>
          <h1 className="qh" translate="no">{c.title}</h1>
          <p className="cp-by" translate="no">{by}</p>
          {c.description ? <p className="cp-desc" translate="no">{c.description}</p> : null}
          {price ? <p className="cp-price">{price}</p> : null}
          <p className="cp-soon">Enrolment opens soon.</p>
        </div>
      </header>
      <section className="cp-lessons" aria-labelledby="cp-l">
        <h2 id="cp-l" className="qh">What&apos;s inside</h2>
        <ol>
          {c.lessons.map((l, i) => (
            <li key={i}>
              <b translate="no">{l.title}</b>{l.free_preview ? <span className="au-on">Free preview</span> : null}
              {l.free_preview && l.video_url ? <div className="fn-video" style={{ marginTop: 10, borderRadius: 10 }}><iframe src={l.video_url} title={l.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div> : null}
              {l.free_preview && l.body ? <p className="cp-body" translate="no">{l.body}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
