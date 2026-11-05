"use server";

import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";
import { loadBoards, loadTeam } from "@/lib/tracking/queries";
import { TEAM_RANKS, type Board, type TeamMember } from "@/lib/tracking/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Boards = { ok: true; boards: Board[]; focus?: string } | { ok: false; error: string };
type Team = { ok: true; team: TeamMember[] } | { ok: false; error: string };

async function ctx() {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return null;
  return { supabase, me: session.user.id };
}
const NO = { ok: false, error: "Tracking is for affiliates." } as const;
const FAIL = (error = "We could not save that. Please try again.") => ({ ok: false, error }) as const;
const clean = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
const fresh = async (c: NonNullable<Awaited<ReturnType<typeof ctx>>>, focus?: string): Promise<Boards> => ({ ok: true, boards: await loadBoards(c.supabase), focus });

/* ---------------------------------------------------------------- boards, lists and cards */
export async function getBoards(): Promise<Boards> { const c = await ctx(); return c ? fresh(c) : NO; }

export async function addBoard(name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO;
  const n = clean(name, 80); if (!n) return FAIL("Give the board a name.");
  const { data: last } = await c.supabase.from("lead_boards").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await c.supabase.from("lead_boards").insert({ user_id: c.me, name: n, position: ((last as { position: number } | null)?.position ?? 0) + 1 }).select("id").single();
  return error ? FAIL() : fresh(c, (data as { id: string }).id);
}
export async function renameBoard(id: string, name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; const n = clean(name, 80);
  if (!UUID.test(id) || !n) return FAIL("Give the board a name.");
  const { error } = await c.supabase.from("lead_boards").update({ name: n }).eq("id", id);
  return error ? FAIL() : fresh(c);
}
export async function deleteBoard(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("lead_boards").delete().eq("id", id);
  return error ? FAIL() : fresh(c);
}
export async function addList(boardId: string, name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; const n = clean(name, 80);
  if (!UUID.test(boardId) || !n) return FAIL("Give the list a name.");
  const { data: last } = await c.supabase.from("lead_lists").select("position").eq("board_id", boardId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.supabase.from("lead_lists").insert({ board_id: boardId, user_id: c.me, name: n, position: ((last as { position: number } | null)?.position ?? 0) + 1 });
  return error ? FAIL() : fresh(c);
}
export async function renameList(id: string, name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; const n = clean(name, 80);
  if (!UUID.test(id) || !n) return FAIL("Give the list a name.");
  const { error } = await c.supabase.from("lead_lists").update({ name: n }).eq("id", id);
  return error ? FAIL() : fresh(c);
}
export async function deleteList(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("lead_lists").delete().eq("id", id);
  return error ? FAIL() : fresh(c);
}
export type CardInput = { name: string; email: string; phone: string; note: string };
function card(v: CardInput): { ok: true; row: { name: string; email: string | null; phone: string | null; note: string | null } } | { ok: false; error: string } {
  const name = clean(v.name, 80), email = clean(v.email, 254), phone = clean(v.phone, 40), note = clean(v.note, 1000);
  if (!name) return { ok: false, error: "Give the lead a name." };
  if (email && !EMAIL.test(email)) return { ok: false, error: "That email address does not look right." };
  return { ok: true, row: { name, email: email || null, phone: phone || null, note: note || null } };
}
export async function addCard(listId: string, v: CardInput): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(listId)) return FAIL();
  const p = card(v); if (!p.ok) return p;
  const { data: last } = await c.supabase.from("lead_cards").select("position").eq("list_id", listId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.supabase.from("lead_cards").insert({ list_id: listId, user_id: c.me, ...p.row, position: ((last as { position: number } | null)?.position ?? -1) + 1 });
  return error ? FAIL() : fresh(c);
}
export async function updateCard(id: string, v: CardInput): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const p = card(v); if (!p.ok) return p;
  const { error } = await c.supabase.from("lead_cards").update(p.row).eq("id", id);
  return error ? FAIL() : fresh(c);
}
export async function deleteCard(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("lead_cards").delete().eq("id", id);
  return error ? FAIL() : fresh(c);
}
/** Puts a card in a list at a place (0 = top) and renumbers that list. */
export async function moveCard(id: string, listId: string, index: number): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id) || !UUID.test(listId)) return FAIL();
  const { data } = await c.supabase.from("lead_cards").select("id").eq("list_id", listId).is("affiliated_at", null).neq("id", id).order("position");
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  ids.splice(Math.max(0, Math.min(ids.length, Math.floor(Number(index) || 0))), 0, id);
  for (let i = 0; i < ids.length; i++) {
    const r = await c.supabase.from("lead_cards").update(i === ids.indexOf(id) ? { list_id: listId, position: i } : { position: i }).eq("id", ids[i]);
    if (r.error) return FAIL();
  }
  return fresh(c);
}
/** "Registered for the Portal": the card jumps to that list on the Leads in the FLC Portal board. */
export async function registerCard(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { data, error } = await c.supabase.rpc("lead_register_in_portal", { p_card: id });
  return error ? FAIL() : fresh(c, String(data));
}
/** "Affiliated": the card becomes a team member. Returns where to go. */
export async function affiliateCard(id: string, rank: string): Promise<{ ok: true; teamId: string } | { ok: false; error: string }> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const r = (TEAM_RANKS as readonly string[]).includes(rank) ? rank : "New";
  const { data, error } = await c.supabase.rpc("lead_affiliated", { p_card: id, p_rank: r });
  return error ? FAIL() : { ok: true, teamId: String(data) };
}

/* ---------------------------------------------------------------- team */
const freshTeam = async (c: NonNullable<Awaited<ReturnType<typeof ctx>>>): Promise<Team> => ({ ok: true, team: await loadTeam(c.supabase) });
export async function getTeam(): Promise<Team> { const c = await ctx(); return c ? freshTeam(c) : NO; }

export async function addTeamMember(v: { name: string; email: string; rank: string }): Promise<Team> {
  const c = await ctx(); if (!c) return NO;
  const name = clean(v.name, 80), email = clean(v.email, 254);
  if (!name) return FAIL("Give your team member a name.");
  if (email && !EMAIL.test(email)) return FAIL("That email address does not look right.");
  const rank = (TEAM_RANKS as readonly string[]).includes(v.rank) ? v.rank : "New";
  const { data, error } = await c.supabase.from("team_members").insert({ user_id: c.me, name, email: email || null, rank }).select("id").single();
  if (error) return FAIL();
  /* the starter check-in list: add it through the same function the Affiliated button uses */
  const rows = STARTER.map((s, i) => ({ member_id: (data as { id: string }).id, user_id: c.me, label: s[0], kind: s[1], position: i }));
  await c.supabase.from("team_checks").insert(rows);
  return freshTeam(c);
}
const STARTER: [string, string][] = [
  ["Created a congratulations graphic for affiliating with the Graphic Maker", "graphic"], ["Congratulated them for starting their business in the New Members Discussion Chat", "welcome_chat"],
  ["Congratulated them in my team chat", "team_chat"], ["Followed them on social media", "manual"], ["Let them know their next steps for getting their business started", "manual"],
  ["Showed them where to find their landing page and invite link", "manual"], ["Introduced them to an accountability buddy", "manual"], ["Helped them set their first weekly goals", "manual"],
  ["Booked our first check-in call", "manual"], ["Invited them to the live calls", "manual"],
  ["They started the Business Launch Course", "course_started"], ["They completed 50% of the Business Launch Course", "course_half"], ["They finished the Business Launch Course", "course_done"],
];
export async function setTeamRank(id: string, rank: string): Promise<Team> {
  const c = await ctx(); if (!c) return NO;
  if (!UUID.test(id) || !(TEAM_RANKS as readonly string[]).includes(rank)) return FAIL();
  const { error } = await c.supabase.from("team_members").update({ rank }).eq("id", id);
  return error ? FAIL() : freshTeam(c);
}
export async function setTeamStatus(id: string, status: string): Promise<Team> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const v = status === "left" || status === "inactive" ? status : null;
  const { error } = await c.supabase.from("team_members").update({ status_override: v }).eq("id", id);
  return error ? FAIL() : freshTeam(c);
}
export async function deleteTeamMember(id: string): Promise<Team> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("team_members").delete().eq("id", id);
  return error ? FAIL() : freshTeam(c);
}
/** Ticks a check-in item on or off. Ticking one counts as a check-in with that person. */
export async function toggleCheck(id: string, done: boolean): Promise<Team> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { data: row, error } = await c.supabase.from("team_checks").update({ done: !!done, done_at: done ? new Date().toISOString() : null }).eq("id", id).select("member_id, label").single();
  if (error || !row) return FAIL();
  if (done) await c.supabase.from("team_members").update({ last_check_in_at: new Date().toISOString(), last_check_in_note: (row as { label: string }).label.slice(0, 200) }).eq("id", (row as { member_id: string }).member_id);
  return freshTeam(c);
}
export async function addCheck(memberId: string, label: string): Promise<Team> {
  const c = await ctx(); if (!c) return NO; const l = clean(label, 200);
  if (!UUID.test(memberId) || !l) return FAIL("Write what you want to check in about.");
  const { data: last } = await c.supabase.from("team_checks").select("position").eq("member_id", memberId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.supabase.from("team_checks").insert({ member_id: memberId, user_id: c.me, label: l, position: ((last as { position: number } | null)?.position ?? 0) + 1 });
  return error ? FAIL() : freshTeam(c);
}
export async function deleteCheck(id: string): Promise<Team> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("team_checks").delete().eq("id", id);
  return error ? FAIL() : freshTeam(c);
}
/** A quick note: "I messaged them today". */
export async function logCheckIn(memberId: string, note: string): Promise<Team> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(memberId)) return FAIL();
  const { error } = await c.supabase.from("team_members").update({ last_check_in_at: new Date().toISOString(), last_check_in_note: clean(note, 200) || "Checked in" }).eq("id", memberId);
  return error ? FAIL() : freshTeam(c);
}

/** Who takes this person's leads' coaching calls: "for" them, "together" with them, or neither (empty). Until a rank, or always. */
export async function setCallPlan(id: string, mode: string, until: string): Promise<Team> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const m = mode === "for" || mode === "together" ? mode : null;
  const u = m && (TEAM_RANKS as readonly string[]).includes(until) ? until : null;
  const { error } = await c.supabase.rpc("set_team_call_plan", { p_member: id, p_mode: m, p_until: u });
  return error ? FAIL() : freshTeam(c);
}
