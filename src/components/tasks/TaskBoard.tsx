"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTask, completeTask, deleteTask, reorderTasks, saveTimezone, undoTask, updateTask, type TaskInput } from "@/app/(app)/tasks/actions";
import { complete, dueLabel, REPEAT_LABEL, split, stateOf, suggestOrder, taskHelp, undo, type Suggestion, type Task } from "@/lib/tasks/schedule";
import { Fireworks } from "./Fireworks";
import { TaskForm } from "./TaskForm";
import { TrashButton } from "./TrashButton";

const CELEBRATED = "flc_tasks_celebrated";

/** The whole Tasks screen: today's list (drag or use the arrows to reorder), what is coming up, and what is done. */
export function TaskBoard({ initial, today, tz }: { initial: Task[]; today: string; tz: string }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [pending, run] = useTransition();

  const { todayList, upcoming, doneToday } = split(tasks, today);
  const total = todayList.length + doneToday.length;

  /* the browser knows the real time zone; tell the server once so "today" and reminder times are right */
  useEffect(() => {
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (here && here !== tz) void saveTimezone(here).then(() => router.refresh());
  }, [tz, router]);

  function celebrateIfClear(next: Task[]) {
    const s = split(next, today);
    if (s.todayList.length > 0 || s.doneToday.length === 0) return;
    try { if (localStorage.getItem(CELEBRATED) === today) return; localStorage.setItem(CELEBRATED, today); } catch { /* still celebrate */ }
    setParty(true);
  }

  function apply(call: () => Promise<{ ok: true; tasks: Task[] } | { ok: false; error: string }>, rollback: Task[]) {
    run(async () => {
      const r = await call();
      if (r.ok) { setTasks(r.tasks); setError(""); } else { setTasks(rollback); setError(r.error); }
    });
  }

  function tick(t: Task) {
    const next = tasks.map((x) => (x.id === t.id ? complete(x, today) : x));
    setTasks(next); setSuggestion(null);
    apply(() => completeTask(t.id), tasks);
    celebrateIfClear(next);
  }
  function untick(t: Task) {
    setTasks(tasks.map((x) => (x.id === t.id ? undo(x) : x)));
    apply(() => undoTask(t.id), tasks);
  }

  function save(v: TaskInput) {
    setFormError("");
    run(async () => {
      const r = editing && editing !== "new" ? await updateTask(editing.id, v) : await addTask(v);
      if (r.ok) { setTasks(r.tasks); setEditing(null); setSuggestion(null); } else setFormError(r.error);
    });
  }
  function removeTask(id: string) {
    const before = tasks;
    setTasks(tasks.filter((t) => t.id !== id)); setSuggestion(null);
    apply(() => deleteTask(id), before);
  }

  function setOrder(ids: string[]) {
    const rest = tasks.filter((t) => !ids.includes(t.id)).sort((a, b) => a.position - b.position).map((t) => t.id);
    const order = [...ids, ...rest];
    const pos = new Map(order.map((id, i) => [id, i + 1]));
    const before = tasks;
    setTasks(tasks.map((t) => ({ ...t, position: pos.get(t.id) ?? t.position })));
    apply(() => reorderTasks(ids), before);
  }
  function nudge(id: string, dir: -1 | 1) {
    const ids = todayList.map((t) => t.id);
    const i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setSuggestion(null);
    setOrder(ids);
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = todayList.map((t) => t.id).filter((x) => x !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null); setSuggestion(null);
    setOrder(ids);
  }

  const alreadyBest = suggestion && suggestion.ids.join() === todayList.map((t) => t.id).join();

  return (
    <div className="tasks">
      <div className="tasks-top">
        <div className="tasks-progress" aria-label={`${doneToday.length} of ${total} done today`}>
          <div className="tasks-count"><strong>{doneToday.length}</strong> of {total} done today</div>
          <div className="tasks-bar"><i style={{ width: total ? `${(doneToday.length / total) * 100}%` : "0%" }} /></div>
        </div>
        <div className="tasks-actions">
          {todayList.length > 1 ? <button type="button" className="btn" onClick={() => setSuggestion(suggestOrder(todayList, today))}>Suggest the best order</button> : null}
          <button type="button" className="btn primary" onClick={() => { setFormError(""); setFormKey((k) => k + 1); setEditing("new"); }}>Add a task</button>
        </div>
      </div>

      {error ? <p className="err" role="alert">{error}</p> : null}

      {suggestion ? (
        <section className="card-s tasks-suggest" aria-label="Suggested order">
          <h2 className="qh" style={{ margin: "0 0 4px", fontSize: 20 }}>{alreadyBest ? "Your order already looks right ✓" : "A smoother order for today"}</h2>
          <p className="when" style={{ margin: "0 0 10px" }}>{suggestion.note}</p>
          <ol>
            {suggestion.ids.map((id) => { const t = tasks.find((x) => x.id === id); return t ? <li key={id}><strong>{t.title}</strong><span className="when">{suggestion.reasons[id]}</span></li> : null; })}
          </ol>
          <div className="tasks-actions">
            {alreadyBest ? null : <button type="button" className="btn primary" onClick={() => { setOrder(suggestion.ids); setSuggestion(null); }}>Use this order</button>}
            <button type="button" className="btn" onClick={() => setSuggestion(null)}>{alreadyBest ? "Close" : "Not now"}</button>
          </div>
        </section>
      ) : null}

      <section aria-label="To do today">
        <h2 className="qh tasks-h">Today</h2>
        {todayList.length === 0 ? (
          <p className="card-s" style={{ margin: 0 }}>{doneToday.length ? "Everything for today is done. Lovely work!" : "Nothing to do today. Add a task to get started."}</p>
        ) : (
          <ul className="task-list">
            {todayList.map((t, i) => {
              const s = stateOf(t, today);
              const help = helpOpen === t.id ? taskHelp(t) : null;
              return (
                <li key={t.id} className={"task" + (dragId === t.id ? " dragging" : "") + (s.kind === "overdue" ? " late" : "")}
                  onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={() => dropOn(t.id)}>
                  <div className="task-row">
                    <button type="button" className="task-grip" draggable aria-label={`Drag to reorder ${t.title}`} onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)}>⋮⋮</button>
                    <button type="button" className="task-check" aria-label={`Mark done: ${t.title}`} onClick={() => tick(t)} />
                    <div className="task-main">
                      <strong>{t.title}</strong>
                      <span className="task-meta">
                        <span className={"pill " + t.area}>{t.area === "business" ? "Business" : "Personal"}</span>
                        <span className="pill">{REPEAT_LABEL[t.repeat]}</span>
                        <span className={"task-due" + (s.kind === "overdue" ? " late" : "")}>{dueLabel(t, today)}</span>
                      </span>
                      {t.note ? <span className="when">{t.note}</span> : null}
                    </div>
                    <div className="task-tools">
                      <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => nudge(t.id, -1)}>▲</button>
                      <button type="button" className="icon-btn" aria-label="Move down" disabled={i === todayList.length - 1} onClick={() => nudge(t.id, 1)}>▼</button>
                      <button type="button" className="linkbtn" onClick={() => setHelpOpen(helpOpen === t.id ? null : t.id)} aria-expanded={helpOpen === t.id}>Need a hand?</button>
                      <button type="button" className="linkbtn" onClick={() => { setFormError(""); setFormKey((k) => k + 1); setEditing(t); }}>Edit</button>
                      <TrashButton label={t.title} busy={pending} onConfirm={() => removeTask(t.id)} />
                    </div>
                  </div>
                  {help ? (
                    <div className="task-help">
                      {help.links.length ? <p className="task-links">{help.links.map((l) => <Link key={l.href} className="btn small" href={l.href} style={{ textDecoration: "none" }}>{l.label}</Link>)}</p> : null}
                      <ul>{help.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {upcoming.length ? (
        <section aria-label="Coming up">
          <h2 className="qh tasks-h">Coming up</h2>
          <ul className="task-list quiet">
            {upcoming.map((t) => (
              <li key={t.id} className="task"><div className="task-row">
                <div className="task-main">
                  <strong>{t.title}</strong>
                  <span className="task-meta"><span className={"pill " + t.area}>{t.area === "business" ? "Business" : "Personal"}</span><span className="pill">{REPEAT_LABEL[t.repeat]}</span><span className="task-due">{dueLabel(t, today)}</span></span>
                </div>
                <div className="task-tools"><button type="button" className="linkbtn" onClick={() => { setFormError(""); setFormKey((k) => k + 1); setEditing(t); }}>Edit</button><TrashButton label={t.title} busy={pending} onConfirm={() => removeTask(t.id)} /></div>
              </div></li>
            ))}
          </ul>
        </section>
      ) : null}

      {doneToday.length ? (
        <section aria-label="Done today">
          <h2 className="qh tasks-h">Done today</h2>
          <ul className="task-list quiet">
            {doneToday.map((t) => (
              <li key={t.id} className="task done"><div className="task-row">
                <button type="button" className="task-check on" aria-label={`Undo: ${t.title}`} onClick={() => untick(t)}>✓</button>
                <div className="task-main"><strong>{t.title}</strong><span className="task-meta"><span className={"pill " + t.area}>{t.area === "business" ? "Business" : "Personal"}</span><span className="pill">{REPEAT_LABEL[t.repeat]}</span></span></div>
                <div className="task-tools"><TrashButton label={t.title} busy={pending} onConfirm={() => removeTask(t.id)} /></div>
              </div></li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="when" style={{ margin: 0 }}>Reminders: we send a banner to your phone the day before and the day a task is due, and again if it becomes overdue. Daily tasks are not sent as banners, so they stay quiet. Your time zone: {tz.replace(/_/g, " ")}.</p>

      <TaskForm key={formKey} open={editing !== null} task={editing && editing !== "new" ? editing : null} today={today} busy={pending} error={formError}
        onSave={save} onClose={() => setEditing(null)} />
      {party ? <Fireworks onClose={() => setParty(false)} /> : null}
    </div>
  );
}
