import { describe, expect, it } from "vitest";
import { complete, daysBetween, dueLabel, nextDue, split, stateOf, suggestOrder, taskHelp, undo, type Task } from "./schedule";

const T = (o: Partial<Task>): Task => ({ id: "1", area: "business", title: "x", note: null, repeat: "once", due_on: null, position: 0, done_on: null, prev_due_on: null, ...o });
const TODAY = "2026-11-10";

describe("task dates", () => {
  it("counts days", () => { expect(daysBetween("2026-11-10", "2026-11-13")).toBe(3); expect(daysBetween("2026-11-10", "2026-11-08")).toBe(-2); });
  it("steps weekly, monthly, quarterly and annual from the original date", () => {
    expect(nextDue("2026-11-03", "weekly", TODAY)).toBe("2026-11-17");
    expect(nextDue("2026-01-31", "monthly", "2026-02-10")).toBe("2026-02-28");
    expect(nextDue("2026-01-31", "monthly", "2026-03-01")).toBe("2026-03-31"); // does not drift to the 28th
    expect(nextDue("2026-10-15", "quarterly", TODAY)).toBe("2027-01-15");
    expect(nextDue("2026-11-10", "annual", TODAY)).toBe("2027-11-10");
  });
  it("moves on from a due date that is still in the future", () => {
    expect(nextDue("2026-11-20", "weekly", TODAY)).toBe("2026-11-27");
  });
});

describe("task state", () => {
  it("knows overdue, today, upcoming, daily and no-date", () => {
    expect(stateOf(T({ due_on: "2026-11-08" }), TODAY)).toEqual({ kind: "overdue", days: 2 });
    expect(stateOf(T({ due_on: TODAY }), TODAY)).toEqual({ kind: "today" });
    expect(stateOf(T({ due_on: "2026-11-12" }), TODAY)).toEqual({ kind: "upcoming", days: 2 });
    expect(stateOf(T({ repeat: "daily" }), TODAY)).toEqual({ kind: "daily" });
    expect(stateOf(T({}), TODAY)).toEqual({ kind: "anytime" });
  });
  it("describes it in words", () => {
    expect(dueLabel(T({ due_on: "2026-11-09" }), TODAY)).toBe("Overdue by 1 day");
    expect(dueLabel(T({ due_on: "2026-11-11" }), TODAY)).toBe("Due tomorrow");
    expect(dueLabel(T({ repeat: "daily" }), TODAY)).toBe("Every day");
  });
  it("ticking off and un-ticking", () => {
    const weekly = T({ repeat: "weekly", due_on: TODAY });
    const done = complete(weekly, TODAY);
    expect(done.done_on).toBe(TODAY);
    expect(done.due_on).toBe("2026-11-17");
    expect(stateOf(done, TODAY)).toEqual({ kind: "done" });
    expect(undo(done)).toMatchObject({ done_on: null, due_on: TODAY, prev_due_on: null });
    expect(stateOf(complete(T({ repeat: "daily" }), TODAY), "2026-11-11")).toEqual({ kind: "daily" }); // a new day: due again
    expect(stateOf(complete(T({ repeat: "once", due_on: TODAY }), TODAY), "2026-11-12")).toEqual({ kind: "done" });
  });
  it("splits into today, coming up and done", () => {
    const list = [T({ id: "a", due_on: "2026-11-12", position: 1 }), T({ id: "b", due_on: TODAY, position: 2 }), T({ id: "c", repeat: "daily", position: 0, done_on: TODAY }), T({ id: "d", repeat: "once", due_on: "2026-11-01", done_on: "2026-11-02", position: 3 })];
    const s = split(list, TODAY);
    expect(s.todayList.map((t) => t.id)).toEqual(["b"]);
    expect(s.upcoming.map((t) => t.id)).toEqual(["a"]);
    expect(s.doneToday.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("suggested order and help", () => {
  it("puts overdue first, then due today, then daily, then no deadline, grouping business before personal", () => {
    const tasks = [
      T({ id: "free", title: "someday", position: 0 }),
      T({ id: "daily-p", repeat: "daily", area: "personal", position: 1 }),
      T({ id: "today-p", area: "personal", due_on: TODAY, position: 2 }),
      T({ id: "today-b", area: "business", due_on: TODAY, position: 3 }),
      T({ id: "late", area: "personal", due_on: "2026-11-05", position: 4 }),
    ];
    expect(suggestOrder(tasks, TODAY).ids).toEqual(["late", "today-b", "today-p", "daily-p", "free"]);
  });
  it("offers portal pages that fit the words", () => {
    const h = taskHelp({ title: "Follow up with 3 leads", note: null, area: "business" });
    expect(h.links.map((l) => l.href)).toContain("/responses");
    expect(h.tips.length).toBeGreaterThanOrEqual(3);
  });
});
