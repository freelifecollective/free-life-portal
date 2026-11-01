"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCourse, deleteCourse, deleteLesson, moveCourse, moveLesson, saveCourse, saveLesson } from "@/app/(app)/admin/classroom/actions";
import type { CourseRow, LessonRow } from "@/lib/classroom/types";

/** The list of courses with a box to start a new one, and arrows to put them in order. */
export function CourseList({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <form className="card-s" onSubmit={(e) => { e.preventDefault(); start(async () => { setError(""); const r = await createCourse(title); if (!r.ok) { setError(r.error); return; } setTitle(""); router.push(`/admin/classroom/${r.id}`); }); }}>
        <label htmlFor="nc-title" className="qh" style={{ display: "block", marginTop: 0 }}>Start a new course</label>
        <div className="rs-actions" style={{ marginTop: 0 }}>
          <input id="nc-title" type="text" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" />
          <button className="btn primary" type="submit" disabled={pending}>Create</button>
        </div>
        {error ? <p className="err" role="alert">{error}</p> : null}
      </form>
      {courses.map((c, i) => (
        <div key={c.id} className="card-s" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div><strong translate="no">{c.title}</strong> {!c.published ? <span className="tag">Draft</span> : null}<br /><span className="when">{`${c.lessons} lessons · ${c.audience === "everyone" ? "Everyone" : "Affiliates only"}`}</span></div>
          <div className="rs-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn small" disabled={pending || i === 0} aria-label="Move up" onClick={() => start(async () => { await moveCourse(c.id, -1); router.refresh(); })}>↑</button>
            <button type="button" className="btn small" disabled={pending || i === courses.length - 1} aria-label="Move down" onClick={() => start(async () => { await moveCourse(c.id, 1); router.refresh(); })}>↓</button>
            <Link className="btn small primary" href={`/admin/classroom/${c.id}`} style={{ textDecoration: "none" }}>Edit</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function LessonForm({ courseId, lesson, onDone }: { courseId: string; lesson?: LessonRow; onDone: () => void }) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [vimeo, setVimeo] = useState(lesson?.vimeo_id ? `https://vimeo.com/${lesson.vimeo_id}${lesson.vimeo_hash ? `/${lesson.vimeo_hash}` : ""}` : "");
  const [body, setBody] = useState(lesson?.body ?? "");
  const [published, setPublished] = useState(lesson?.published ?? false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const id = lesson?.id ?? "new";
  return (
    <form className="set-form" onSubmit={(e) => { e.preventDefault(); start(async () => { setError(""); const r = await saveLesson({ id: lesson?.id, courseId, title, vimeo, body, published }); if (!r.ok) { setError(r.error); return; } if (!lesson) { setTitle(""); setVimeo(""); setBody(""); setPublished(false); } onDone(); }); }}>
      <div className="field"><label htmlFor={`lt-${id}`}>Lesson title</label><input id={`lt-${id}`} type="text" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label htmlFor={`lv-${id}`}>Vimeo link (optional)</label><input id={`lv-${id}`} type="text" value={vimeo} onChange={(e) => setVimeo(e.target.value)} placeholder="https://vimeo.com/123456789" /></div>
      <div className="field"><label htmlFor={`lb-${id}`}>Notes (optional)</label><textarea id={`lb-${id}`} rows={5} maxLength={8000} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <label className="check" style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <span>Show this lesson to members</span></label>
      <div className="rs-actions" style={{ marginTop: 0 }}><button className="btn small primary" type="submit" disabled={pending}>{lesson ? "Save lesson" : "Add lesson"}</button></div>
      {error ? <p className="err" role="alert" style={{ minHeight: 0 }}>{error}</p> : null}
    </form>
  );
}

/** Edit one course: its details, and its lessons (add, change, reorder, remove). */
export function CourseEditor({ course, lessons }: { course: CourseRow; lessons: LessonRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [audience, setAudience] = useState<string>(course.audience);
  const [published, setPublished] = useState(course.published);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <form className="card-s set-form" onSubmit={(e) => { e.preventDefault(); start(async () => { setMsg(""); const r = await saveCourse({ id: course.id, title, description, audience, published }); setMsg(r.ok ? "Saved." : r.error); router.refresh(); }); }}>
        <h2 className="qh" style={{ margin: 0 }}>Course details</h2>
        <div className="field"><label htmlFor="cd-title">Title</label><input id="cd-title" type="text" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label htmlFor="cd-desc">Description (optional)</label><textarea id="cd-desc" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="field"><label htmlFor="cd-aud">Who can see it</label>
          <select id="cd-aud" value={audience} onChange={(e) => setAudience(e.target.value)}><option value="affiliates">Affiliates only</option><option value="everyone">Everyone, including leads</option></select></div>
        <label className="check" style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <span>Show this course to members</span></label>
        <div className="set-actions"><button className="btn primary" type="submit" disabled={pending}>Save course</button><span role="status" className="when">{msg}</span></div>
      </form>

      <section className="card-s" style={{ display: "grid", gap: 12 }}>
        <h2 className="qh" style={{ margin: 0 }}>Lessons</h2>
        {lessons.map((l, i) => (
          <details key={l.id} className="cl-edit">
            <summary><span translate="no">{`${i + 1}. ${l.title}`}</span> {!l.published ? <span className="tag">Draft</span> : null}</summary>
            <div style={{ display: "grid", gap: 10, paddingTop: 10 }}>
              <div className="rs-actions" style={{ marginTop: 0 }}>
                <button type="button" className="btn small" disabled={pending || i === 0} aria-label="Move up" onClick={() => start(async () => { await moveLesson(l.id, course.id, -1); router.refresh(); })}>↑</button>
                <button type="button" className="btn small" disabled={pending || i === lessons.length - 1} aria-label="Move down" onClick={() => start(async () => { await moveLesson(l.id, course.id, 1); router.refresh(); })}>↓</button>
                <button type="button" className="linkbtn danger" onClick={() => { if (window.confirm("Delete this lesson?")) start(async () => { await deleteLesson(l.id); router.refresh(); }); }}>Delete lesson</button>
              </div>
              <LessonForm courseId={course.id} lesson={l} onDone={() => router.refresh()} />
            </div>
          </details>
        ))}
        <details className="cl-edit" open={lessons.length === 0}>
          <summary><strong>Add a lesson</strong></summary>
          <div style={{ paddingTop: 10 }}><LessonForm courseId={course.id} onDone={() => router.refresh()} /></div>
        </details>
      </section>

      <section className="card-s">
        {confirm ? (
          <p className="err" style={{ minHeight: 0, margin: 0 }}>Delete this whole course and its lessons? <button type="button" className="linkbtn danger" disabled={pending} onClick={() => start(async () => { const r = await deleteCourse(course.id); if (r.ok) router.push("/admin/classroom"); })}>Yes, delete</button> <button type="button" className="linkbtn" onClick={() => setConfirm(false)}>No</button></p>
        ) : <button type="button" className="linkbtn danger" onClick={() => setConfirm(true)}>Delete this course</button>}
      </section>
    </div>
  );
}
