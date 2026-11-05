import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Board, Card, ListT, Tag, TeamCheck, TeamMember, TeamStatus } from "./types";

/** All of the person's boards with their lists and cards, and their tags (making the starter boards and tags the first time). */
export async function loadBoards(supabase: SupabaseClient): Promise<{ boards: Board[]; tags: Tag[] }> {
  await Promise.all([supabase.rpc("ensure_lead_boards"), supabase.rpc("ensure_lead_tags")]);
  const [{ data: bs }, { data: ls }, { data: cs }, { data: tg }, { data: ct }, { data: pu }] = await Promise.all([
    supabase.from("lead_boards").select("id, name, kind").order("position").order("created_at"),
    supabase.from("lead_lists").select("id, board_id, name, kind").order("position"),
    supabase.from("lead_cards").select("id, list_id, name, email, phone, note, instagram, facebook, follow_up_on, follow_up_days").is("affiliated_at", null).order("position").limit(3000),
    supabase.from("lead_tags").select("id, name, color, system_key").order("created_at"),
    supabase.from("lead_card_tags").select("card_id, tag_id").limit(20000),
    supabase.rpc("lead_card_portal_users"),
  ]);
  const portal = new Map(((pu ?? []) as { card_id: string; username: string }[]).map((r) => [r.card_id, r.username]));
  const tagsOf = new Map<string, string[]>();
  for (const r of (ct ?? []) as { card_id: string; tag_id: string }[]) tagsOf.set(r.card_id, [...(tagsOf.get(r.card_id) ?? []), r.tag_id]);
  const cards = new Map<string, Card[]>();
  for (const c of (cs ?? []) as { id: string; list_id: string; name: string; email: string | null; phone: string | null; note: string | null; instagram: string | null; facebook: string | null; follow_up_on: string | null; follow_up_days: number }[]) {
    cards.set(c.list_id, [...(cards.get(c.list_id) ?? []), { id: c.id, name: c.name, email: c.email, phone: c.phone, note: c.note, instagram: c.instagram, facebook: c.facebook, tags: tagsOf.get(c.id) ?? [], followUp: c.follow_up_on, followDays: c.follow_up_days, portalUser: portal.get(c.id) ?? null }]);
  }
  const lists = new Map<string, ListT[]>();
  for (const l of (ls ?? []) as { id: string; board_id: string; name: string; kind: string | null }[]) lists.set(l.board_id, [...(lists.get(l.board_id) ?? []), { id: l.id, name: l.name, kind: l.kind, cards: cards.get(l.id) ?? [] }]);
  const boards = ((bs ?? []) as { id: string; name: string; kind: string | null }[]).map((b) => ({ ...b, lists: lists.get(b.id) ?? [] }));
  const tags: Tag[] = ((tg ?? []) as { id: string; name: string; color: string; system_key: string | null }[]).map((t) => ({ id: t.id, name: t.name, color: t.color, system: !!t.system_key }));
  return { boards, tags };
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
