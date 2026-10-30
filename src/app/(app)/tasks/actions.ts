"use server";

import { requireMember } from "@/lib/auth/guards";
import { tagOf } from "@/lib/badges/defs";
import { complete, REPEATS, split, undo, type Area, type Repeat, type Task } from "@/lib/tasks/schedule";
import { getTz, listTasks, todayIn, validZone } from "@/lib/tasks/queries";

export type TaskInput = { area: string; title: string; note: string; repeat: string; due_on: string };
type Result = { ok: true; tasks: Task[]; badges?: string[] } | { ok: false; error: string; tasks?: Task[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parse(i: TaskInput): { ok: true; v: { area: Area; title: string; note: string | null; repeat: Repeat; due_on: string | null } } | { ok: false; error: string } {
  const title = String(i.title ?? "").trim();
  const note = String(i.note ?? "").trim();
  const repeat = i.repeat as Repeat;
  if (i.area !== "business" && i.area !== "personal") return { ok: false, error: "Choose business or personal." };
  if (!title || title.length > 120) return { ok: false, error: "Give the task a title of up to 120 characters." };
  if (note.length > 1000) return { ok: false, error: "Keep the description under 1000 characters." };
  if (!REPEATS.includes(repeat)) return { ok: false, error: "Choose how often it repeats." };
  const due = String(i.due_on ?? "").trim();
  if (due && (!DAY.test(due) || Number.isNaN(Date.parse(due)))) return { ok: false, error: "That due date is not a real date." };
  if (repeat === "daily") return { ok: true, v: { area: i.area, title, note: note || null, repeat, due_on: null } };
  if (repeat !== "once" && !due) return { ok: false, error: "Choose the date it is next due." };
  return { ok: true, v: { area: i.area, title, note: note || null, repeat, due_on: due || null } };
}

async function ctx() {
  const { session, supabase } = await requireMember();
  if (!supabase || session.profile.role === "lead") return null;
  const tz = await getTz(supabase);
  return { supabase, me: session.user.id, today: todayIn(tz) };
}
const fresh = async (c: NonNullable<Awaited<ReturnType<typeof ctx>>>): Promise<Result> => ({ ok: true, tasks: await listTasks(c.supabase) });
const NO = { ok: false, error: "Tasks are for affiliates." } as const;
const FAIL = (error = "We could not save that. Please try again."): Result => ({ ok: false, error });

export async function addTask(input: TaskInput): Promise<Result> {
  const c = await ctx(); if (!c) return NO;
  const p = parse(input); if (!p.ok) return p;
  const { data: last } = await c.supabase.from("tasks").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.supabase.from("tasks").insert({ user_id: c.me, ...p.v, position: (last?.position ?? 0) + 1 });
  return error ? FAIL() : fresh(c);
}

export async function updateTask(id: string, input: TaskInput): Promise<Result> {
  if (!UUID.test(id)) return FAIL("Something went wrong.");
  const c = await ctx(); if (!c) return NO;
  const p = parse(input); if (!p.ok) return p;
  const { error } = await c.supabase.from("tasks").update({ ...p.v, done_on: null, prev_due_on: null }).eq("id", id);
  return error ? FAIL() : fresh(c);
}

export async function completeTask(id: string): Promise<Result> {
  if (!UUID.test(id)) return FAIL("Something went wrong.");
  const c = await ctx(); if (!c) return NO;
  const { data } = await c.supabase.from("tasks").select("id, area, title, note, repeat, due_on, position, done_on, prev_due_on").eq("id", id).maybeSingle();
  if (!data) return FAIL("We could not find that task.");
  const t = data as Task;
  if (t.done_on === c.today) return fresh(c);
  const n = complete(t, c.today);
  const { error } = await c.supabase.from("tasks").update({ done_on: n.done_on, prev_due_on: n.prev_due_on, due_on: n.due_on }).eq("id", id);
  if (error) return FAIL();
  /* for the streaks: what was done today, whether the whole list is now clear, and any badge that was just earned */
  await c.supabase.from("task_completions").insert({ user_id: c.me, task_id: id, tag: tagOf(t.title), done_on: c.today });
  const tasks = await listTasks(c.supabase);
  const s = split(tasks, c.today);
  if (s.todayList.length === 0 && s.doneToday.length > 0) await c.supabase.from("task_clear_days").upsert({ user_id: c.me, day: c.today }, { onConflict: "user_id,day", ignoreDuplicates: true });
  const { data: st } = await c.supabase.rpc("badge_state");
  const badges = Array.isArray(st?.new) ? (st.new as string[]) : [];
  return { ok: true, tasks, badges };
}

export async function undoTask(id: string): Promise<Result> {
  if (!UUID.test(id)) return FAIL("Something went wrong.");
  const c = await ctx(); if (!c) return NO;
  const { data } = await c.supabase.from("tasks").select("id, area, title, note, repeat, due_on, position, done_on, prev_due_on").eq("id", id).maybeSingle();
  if (!data) return FAIL("We could not find that task.");
  const n = undo(data as Task);
  const { error } = await c.supabase.from("tasks").update({ done_on: null, prev_due_on: null, due_on: n.due_on }).eq("id", id);
  if (error) return FAIL();
  await c.supabase.from("task_completions").delete().eq("task_id", id).eq("done_on", c.today);
  await c.supabase.from("task_clear_days").delete().eq("day", c.today);
  return fresh(c);
}

export async function deleteTask(id: string): Promise<Result> {
  if (!UUID.test(id)) return FAIL("Something went wrong.");
  const c = await ctx(); if (!c) return NO;
  const { error } = await c.supabase.from("tasks").delete().eq("id", id);
  return error ? FAIL() : fresh(c);
}

/** Saves the order: the ids given, first to last, get the places 1, 2, 3 and so on (the other tasks keep theirs after them). */
export async function reorderTasks(ids: string[]): Promise<Result> {
  const list = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && UUID.test(x)).slice(0, 500);
  const c = await ctx(); if (!c) return NO;
  const all = await listTasks(c.supabase);
  const rest = all.filter((t) => !list.includes(t.id)).map((t) => t.id);
  const order = [...list.filter((id) => all.some((t) => t.id === id)), ...rest];
  const results = await Promise.all(order.map((id, i) => c.supabase.from("tasks").update({ position: i + 1 }).eq("id", id)));
  return results.some((r) => r.error) ? FAIL() : fresh(c);
}

/** Remembers the person's time zone so "today" and reminder times are theirs. */
export async function saveTimezone(tz: string): Promise<void> {
  if (!validZone(tz)) return;
  const { session, supabase } = await requireMember();
  if (!supabase) return;
  await supabase.from("member_prefs").upsert({ member_id: session.user.id, tz }, { onConflict: "member_id" });
}
