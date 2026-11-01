"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLessonDone } from "@/app/(app)/classroom/actions";
import { vimeoSrc, type LessonRow } from "@/lib/classroom/types";

/** One lesson: the video, the notes, and a button to tick it off and move on. */
export function LessonView({ lesson, courseId, done, nextId, nextTitle }: { lesson: LessonRow; courseId: string; done: boolean; nextId: string | null; nextTitle: string | null }) {
  const router = useRouter();
  const [isDone, setDone] = useState(done);
  const [pending, start] = useTransition();
  const toggle = () => start(async () => { const next = !isDone; setDone(next); const r = await setLessonDone(lesson.id, next); if (!r.ok) setDone(!next); else router.refresh(); });
  return (
    <article className="cl-lesson">
      {lesson.vimeo_id ? (
        <div className="cl-video"><iframe src={vimeoSrc(lesson.vimeo_id, lesson.vimeo_hash)} title={lesson.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
      ) : null}
      <h2 className="cl-title" translate="no">{lesson.title}</h2>
      {lesson.body ? <p className="cl-notes" translate="no">{lesson.body}</p> : null}
      <div className="rs-actions">
        <button type="button" className={"btn " + (isDone ? "" : "primary")} disabled={pending} onClick={toggle}>{isDone ? "✓ Done. Tap to undo" : "Mark as done"}</button>
        {nextId ? <Link className="btn" href={`/classroom/${courseId}?lesson=${nextId}`} style={{ textDecoration: "none" }}>{`Next: ${nextTitle ?? ""} →`}</Link> : null}
      </div>
    </article>
  );
}
