"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createCourse, deleteCourse, saveCourse, saveLessons, type LessonInput } from "@/app/(app)/my-courses/actions";
import { SUPABASE_URL } from "@/lib/env";
import { shrinkImage } from "@/lib/images/shrink";
import { createClient } from "@/lib/supabase/client";

/** The box to start a new course. */
export function NewCourse() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="mc-new card-s" onSubmit={(e) => { e.preventDefault(); setErr(""); start(async () => { const r = await createCourse(title); if (r.ok && r.id) router.push(`/my-courses/${r.id}`); else setErr(r.error ?? "Something went wrong."); }); }}>
      <div className="field"><label htmlFor="mc-title">Name of your new course</label><input id="mc-title" type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Healthy habits in 30 days" /></div>
      <button type="submit" className="btn primary" disabled={pending || !title.trim()}>Create course</button>
      {err ? <p className="status bad" role="alert">{err}</p> : null}
    </form>
  );
}

type Course = { id: string; title: string; slug: string; description: string | null; cover_url: string | null; price_cents: number | null; currency: string; published: boolean };
type Lesson = { id: string; title: string; body: string | null; video_url: string | null; free_preview: boolean };

/** Everything about one course: its details and price, its lessons, and getting paid. */
export function CourseBuilder({ course, lessons: initial, userId, username }: { course: Course; lessons: Lesson[]; userId: string; username: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [c, setC] = useState({ title: course.title, description: course.description ?? "", cover_url: course.cover_url, price: course.price_cents ? (course.price_cents / 100).toFixed(2) : "", currency: course.currency, published: course.published });
  const [lessons, setLessons] = useState<LessonInput[]>(initial.map((l) => ({ id: l.id, title: l.title, body: l.body ?? "", video: l.video_url ?? "", free_preview: l.free_preview })));
  const [open, setOpen] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => start(async () => {
    setMsg(null);
    const a = await saveCourse(course.id, c);
    if (!a.ok) { setMsg({ ok: false, text: a.error ?? "Something went wrong." }); return; }
    const b = await saveLessons(course.id, lessons);
    setMsg(b.ok ? { ok: true, text: "Saved ✓" } : { ok: false, text: b.error ?? "Something went wrong." });
    if (b.ok) router.refresh();
  });
  const setLesson = (i: number, change: Partial<LessonInput>) => setLessons(lessons.map((l, k) => (k === i ? { ...l, ...change } : l)));
  const moveLesson = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= lessons.length) return; const l = [...lessons]; [l[i], l[j]] = [l[j], l[i]]; setLessons(l); setOpen(j); };

  return (
    <div className="mc">
      <div className="mc-top">
        <a className="linkbtn" href="/my-courses">← My Courses</a>
        <div className="mv-actions">
          {course.published && username ? <a className="btn small" href={`/c/${username}/${course.slug}`} target="_blank" rel="noopener noreferrer">Open the course page</a> : null}
          <button type="button" className="btn primary" disabled={pending} onClick={save}>Save course</button>
        </div>
      </div>
      {msg ? <p className={"status " + (msg.ok ? "ok" : "bad")} role="status">{msg.text}</p> : null}

      <section className="lpc-card mc-details">
        <h2 className="qh lpc-h">Course details</h2>
        <div className="field"><label htmlFor="mc-t">Name</label><input id="mc-t" type="text" maxLength={120} value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="mc-d">What students will learn</label><textarea id="mc-d" rows={5} maxLength={4000} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></div>
        <div className="mc-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.cover_url ? <img src={c.cover_url} alt="" /> : <div className="fn-empty">Cover picture</div>}
          <div className="lpc-poster-actions">
            <button type="button" className="btn small" disabled={pending} onClick={() => fileRef.current?.click()}>{c.cover_url ? "Change cover" : "Add a cover"}</button>
            {c.cover_url ? <button type="button" className="linkbtn" onClick={() => setC({ ...c, cover_url: null })}>Remove</button> : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f || !/^image\//.test(f.type) || f.size > 15 * 1024 * 1024) return;
            start(async () => {
              const { blob, ext, type } = await shrinkImage(f, 1600);
              const path = `${userId}/courses/${course.id}-${Date.now()}.${ext}`;
              const { error } = await createClient().storage.from("landing").upload(path, blob, { contentType: type, cacheControl: "31536000" });
              if (error) setMsg({ ok: false, text: "We could not upload that picture." });
              else setC((x) => ({ ...x, cover_url: `${SUPABASE_URL}/storage/v1/object/public/landing/${path}` }));
            });
          }} />
        </div>
        <div className="mc-price">
          <div className="field"><label htmlFor="mc-p">Price</label><input id="mc-p" type="text" inputMode="decimal" placeholder="49.00" value={c.price} onChange={(e) => setC({ ...c, price: e.target.value })} /></div>
          <div className="field"><label htmlFor="mc-c">Currency</label>
            <select id="mc-c" value={c.currency} onChange={(e) => setC({ ...c, currency: e.target.value })}>{["usd", "cad", "eur", "gbp", "aud"].map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}</select>
          </div>
        </div>
        <label className="check-inline"><input type="checkbox" checked={c.published} onChange={(e) => setC({ ...c, published: e.target.checked })} /> Published (anyone with the link can see the course page)</label>
      </section>

      <section className="lpc-card">
        <div className="mv-head"><h2 className="qh lpc-h">Lessons</h2><button type="button" className="btn small" onClick={() => { setLessons([...lessons, { title: `Lesson ${lessons.length + 1}`, body: "", video: "", free_preview: lessons.length === 0 }]); setOpen(lessons.length); }}>+ Add a lesson</button></div>
        {lessons.length === 0 ? <p className="when">No lessons yet.</p> : null}
        <ol className="mc-lessons">
          {lessons.map((l, i) => (
            <li key={l.id ?? `new-${i}`} className="mc-lesson">
              <div className="mc-lesson-head">
                <button type="button" className="mc-lesson-name" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}><span translate="no">{l.title || "Untitled lesson"}</span>{l.free_preview ? <small className="au-on">Free preview</small> : null}</button>
                <span className="fe-step-tools">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveLesson(i, -1)}>↑</button>
                  <button type="button" aria-label="Move down" disabled={i === lessons.length - 1} onClick={() => moveLesson(i, 1)}>↓</button>
                  <button type="button" aria-label="Delete lesson" onClick={() => { if (window.confirm(`Delete "${l.title}"?`)) { setLessons(lessons.filter((_, k) => k !== i)); setOpen(null); } }}>🗑</button>
                </span>
              </div>
              {open === i ? (
                <div className="mc-lesson-body">
                  <div className="field"><label htmlFor={`ml-t-${i}`}>Lesson title</label><input id={`ml-t-${i}`} type="text" maxLength={120} value={l.title} onChange={(e) => setLesson(i, { title: e.target.value })} /></div>
                  <div className="field"><label htmlFor={`ml-v-${i}`}>Video (Vimeo or YouTube link)</label><input id={`ml-v-${i}`} type="url" value={l.video} onChange={(e) => setLesson(i, { video: e.target.value })} placeholder="https://vimeo.com/..." /></div>
                  <div className="field"><label htmlFor={`ml-b-${i}`}>Lesson notes</label><textarea id={`ml-b-${i}`} rows={6} maxLength={20000} value={l.body} onChange={(e) => setLesson(i, { body: e.target.value })} /></div>
                  <label className="check-inline"><input type="checkbox" checked={l.free_preview} onChange={(e) => setLesson(i, { free_preview: e.target.checked })} /> Free preview (anyone can watch this lesson on the course page)</label>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="lpc-card">
        <h2 className="qh lpc-h">Get paid</h2>
        <p className="when">Connect your own Stripe or PayPal account and buyers pay you directly. Connecting opens soon; you can build and publish your course now.</p>
        <div className="mv-actions">
          <button type="button" className="btn" disabled>Connect Stripe</button>
          <button type="button" className="btn" disabled>Connect PayPal</button>
        </div>
      </section>

      <button type="button" className="linkbtn danger" disabled={pending} onClick={() => { if (window.confirm(`Delete "${course.title}" and all its lessons? This cannot be undone.`)) start(async () => { await deleteCourse(course.id); router.push("/my-courses"); }); }}>Delete this course</button>
    </div>
  );
}
