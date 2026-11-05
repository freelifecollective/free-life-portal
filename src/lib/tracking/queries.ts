import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Board, Card, ListT, TeamCheck, TeamMember, TeamStatus } from "./types";

/** All of the person's boards with their lists and cards (making the two starter boards the first time). */
export async function loadBoards(supabase: SupabaseClient): Promise<Board[]> {
  await supabase.rpc("ensure_lead_boards");
  const [{ data: bs }, { data: ls }, { data: cs }] = await Promise.all([
    supabase.from("lead_boards").select("id, name, kind").order("position").order("created_at"),
    supabase.from("lead_lists").select("id, board_id, name, kind").order("position"),
    supabase.from("lead_cards").select("id, list_id, name, email, phone, note").is("affiliated_at", null).order("position").limit(3000),
  ]);
  const cards = new Map<string, Card[]>();
  for (const c of (cs ?? []) as (Card & { list_id: string })[]) cards.set(c.list_id, [...(cards.get(c.list_id) ?? []), { id: c.id, name: c.name, email: c.email, phone: c.phone, note: c.note }]);
  const lists = new Map<string, ListT[]>();
  for (const l of (ls ?? []) as { id: string; board_id: string; name: string; kind: string | null }[]) lists.set(l.board_id, [...(lists.get(l.board_id) ?? []), { id: l.id, name: l.name, kind: l.kind, cards: cards.get(l.id) ?? [] }]);
  return ((bs ?? []) as { id: string; name: string; kind: string | null }[]).map((b) => ({ ...b, lists: lists.get(b.id) ?? [] }));
}

type Row = { id: string; name: string; email: string | null; rank: string; status: TeamStatus | "not_in_portal"; last_check_in_at: string | null; last_check_in_note: string | null; started: boolean; done_lessons: number; total_lessons: number | null; calls_mode: "for" | "together" | null; calls_until_rank: string | null };

/** The team, A to Z, each with their check-in list. */
export async function loadTeam(supabase: SupabaseClient): Promise<TeamMember[]> {
  const [{ data: ov }, { data: ck }] = await Promise.all([
    supabase.rpc("my_team_overview"),
    supabase.from("team_checks").select("id, member_id, label, kind, done").order("position").limit(5000),
  ]);
  const checks = new Map<string, TeamCheck[]>();
  for (const c of (ck ?? []) as (TeamCheck & { member_id: string })[]) checks.set(c.member_id, [...(checks.get(c.member_id) ?? []), { id: c.id, label: c.label, kind: c.kind, done: c.done }]);
  return ((ov ?? []) as Row[]).map((r) => ({
    id: r.id, name: r.name, email: r.email, rank: r.rank, status: r.status as TeamStatus, lastCheckIn: r.last_check_in_at, lastNote: r.last_check_in_note,
    checks: checks.get(r.id) ?? [], started: r.started, doneLessons: r.done_lessons, totalLessons: r.total_lessons ?? 0, callsMode: r.calls_mode, callsUntil: r.calls_until_rank,
  })).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
