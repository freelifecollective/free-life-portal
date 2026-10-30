"use client";

import { useEffect, useRef, useState } from "react";
import { REPEATS, REPEAT_LABEL, type Area, type Repeat, type Task } from "@/lib/tasks/schedule";
import type { TaskInput } from "@/app/(app)/tasks/actions";

/** Add a task, or edit one. Business or personal, a title, an optional description, and how often it repeats. */
export function TaskForm({ open, task, today, busy, error, onSave, onClose }: {
  open: boolean; task: Task | null; today: string; busy: boolean; error: string;
  onSave: (v: TaskInput) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [area, setArea] = useState<Area>(task?.area ?? "business");
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? "once");
  const [due, setDue] = useState(task?.due_on ?? "");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const needsDate = repeat !== "daily" && repeat !== "once";
  const submit = (e: React.FormEvent) => { e.preventDefault(); onSave({ area, title, note, repeat, due_on: repeat === "daily" ? "" : due || (needsDate ? today : "") }); };

  return (
    <dialog ref={ref} className="rs-dialog task-dlg" aria-labelledby="tf-title" onClose={onClose}
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); }}>
      <form onSubmit={submit} noValidate>
        <h2 id="tf-title" className="qh" style={{ marginTop: 0 }}>{task ? "Edit task" : "Add a task"}</h2>
        <div className="seg" role="radiogroup" aria-label="Business or personal">
          {(["business", "personal"] as Area[]).map((a) => (
            <label key={a} className={area === a ? "on" : ""}><input type="radio" name="area" checked={area === a} onChange={() => setArea(a)} />{a === "business" ? "Business" : "Personal"}</label>
          ))}
        </div>
        <div className="field"><label htmlFor="tf-t">What needs doing?</label>
          <input id="tf-t" type="text" maxLength={120} required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow up with three leads" /></div>
        <div className="field"><label htmlFor="tf-n">Description (optional)</label>
          <textarea id="tf-n" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="row">
          <div className="field"><label htmlFor="tf-r">How often?</label>
            <select id="tf-r" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>{REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}</select></div>
          {repeat !== "daily" ? (
            <div className="field"><label htmlFor="tf-d">{needsDate ? "Next due on" : "Due on (optional)"}</label>
              <input id="tf-d" type="date" value={due} onChange={(e) => setDue(e.target.value)} required={needsDate} /></div>
          ) : <p className="when" style={{ alignSelf: "end", margin: 0 }}>Daily tasks show up fresh every morning.</p>}
        </div>
        <p className="err" role="alert">{error}</p>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save task"}</button>
        </div>
      </form>
    </dialog>
  );
}
