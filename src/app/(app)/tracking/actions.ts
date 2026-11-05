"use server";

import { requireMember } from "@/lib/auth/guards";
import { isAffiliate } from "@/lib/roles";
import { sendLoginEmail } from "@/lib/auth/invite-email";
import { loadBoards, loadTeam } from "@/lib/tracking/queries";
import { TEAM_RANKS, type Board, type Tag, type TeamMember } from "@/lib/tracking/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Boards = { ok: true; boards: Board[]; tags: Tag[]; focus?: string } | { ok: false; error: string };
type Team = { ok: true; team: TeamMember[] } | { ok: false; error: string };

async function ctx() {
  const { session, supabase } = await requireMember();
  if (!supabase || !isAffiliate(session.profile.role)) return null;
  return { supabase, me: session.user.id };
}
const NO = { ok: false, error: "Tracking is for affiliates." } as const;
const FAIL = (error = "We could not save that. Please try again.") => ({ ok: false, error }) as const;
const clean = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

/* ---------------------------------------------------------------- boards, lists and cards */
type Ctx = NonNullable<Awaited<ReturnType<typeof ctx>>>;
const freshB = async (c: Ctx, focus?: string): Promise<Boards> => { const { boards, tags } = await loadBoards(c.supabase); return { ok: true, boards, tags, focus }; };
export async function getBoards(): Promise<Boards> { const c = await ctx(); return c ? freshB(c) : NO; }

export async function addBoard(name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO;
  const n = clean(name, 80); if (!n) return FAIL("Give the board a name.");
  const { data: last } = await c.supabase.from("lead_boards").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await c.supabase.from("lead_boards").insert({ user_id: c.me, name: n, position: ((last as { position: number } | null)?.position ?? 0) + 1 }).select("id").single();
  return error ? FAIL() : freshB(c, (data as { id: string }).id);
}
export async function renameBoard(id: string, name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; const n = clean(name, 80);
  if (!UUID.test(id) || !n) return FAIL("Give the board a name.");
  const { error } = await c.supabase.from("lead_boards").update({ name: n }).eq("id", id);
  return error ? FAIL() : freshB(c);
}
export async function deleteBoard(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("lead_boards").delete().eq("id", id);
  return error ? FAIL() : freshB(c);
}
export async function addList(boardId: string, name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; const n = clean(name, 80);
  if (!UUID.test(boardId) || !n) return FAIL("Give the list a name.");
  const { data: last } = await c.supabase.from("lead_lists").select("position").eq("board_id", boardId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.supabase.from("lead_lists").insert({ board_id: boardId, user_id: c.me, name: n, position: ((last as { position: number } | null)?.position ?? 0) + 1 });
  return error ? FAIL() : freshB(c);
}
export async function renameList(id: string, name: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; const n = clean(name, 80);
  if (!UUID.test(id) || !n) return FAIL("Give the list a name.");
  const { error } = await c.supabase.from("lead_lists").update({ name: n }).eq("id", id);
  return error ? FAIL() : freshB(c);
}
export async function deleteList(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("lead_lists").delete().eq("id", id);
  return error ? FAIL() : freshB(c);
}
export type CardInput = { name: string; email: string; phone: string; instagram: string; facebook: string; note: string; tags: string[]; followUp: string; followDays: number };
function card(v: CardInput): { ok: true; row: { name: string; email: string | null; phone: string | null; instagram: string | null; facebook: string | null; note: string | null; follow_up_on: string | null; follow_up_days: number }; tags: string[] } | { ok: false; error: string } {
  const name = clean(v.name, 80), email = clean(v.email, 254), phone = clean(v.phone, 40), note = clean(v.note, 1000), ig = clean(v.instagram, 60), fb = clean(v.facebook, 80);
  const day = clean(v.followUp, 10); const days = Math.round(Number(v.followDays));
  if (!name) return { ok: false, error: "Give the lead a name." };
  if (email && !EMAIL.test(email)) return { ok: false, error: "That email address does not look right." };
  if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)))) return { ok: false, error: "That follow-up date is not a real date." };
  const tags = (Array.isArray(v.tags) ? v.tags : []).filter((t) => typeof t === "string" && UUID.test(t)).slice(0, 40);
  return { ok: true, tags, row: { name, email: email || null, phone: phone || null, instagram: ig || null, facebook: fb || null, note: note || null, follow_up_on: day || null, follow_up_days: Number.isFinite(days) ? Math.min(365, Math.max(1, days)) : 3 } };
}
/** The tags on a card are saved before the card itself, so tags the system adds when the card is saved are kept. */
async function setTags(c: Ctx, cardId: string, tags: string[]) {
  await c.supabase.from("lead_card_tags").delete().eq("card_id", cardId);
  if (tags.length) await c.supabase.from("lead_card_tags").insert(tags.map((t) => ({ card_id: cardId, tag_id: t })));
}
/** A follow-up date means "Follow Up Set": the card goes there (if its board has that list) unless it is already there. */
async function toFollowUpSet(c: Ctx, cardId: string) {
  const { data: row } = await c.supabase.from("lead_cards").select("list_id, lead_lists(name, board_id)").eq("id", cardId).maybeSingle();
  const l = (row as { list_id: string; lead_lists: { name: string; board_id: string } | null } | null)?.lead_lists;
  if (!l || /^follow up set/i.test(l.name)) return;
  const { data: target } = await c.supabase.from("lead_lists").select("id").eq("board_id", l.board_id).ilike("name", "follow up set%").order("position").limit(1).maybeSingle();
  if (!target) return;
  const { data: last } = await c.supabase.from("lead_cards").select("position").eq("list_id", (target as { id: string }).id).order("position", { ascending: false }).limit(1).maybeSingle();
  await c.supabase.from("lead_cards").update({ list_id: (target as { id: string }).id, position: ((last as { position: number } | null)?.position ?? -1) + 1 }).eq("id", cardId);
}
export async function addCard(listId: string, v: CardInput): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(listId)) return FAIL();
  const p = card(v); if (!p.ok) return p;
  const { data: last } = await c.supabase.from("lead_cards").select("position").eq("list_id", listId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await c.supabase.from("lead_cards").insert({ list_id: listId, user_id: c.me, ...p.row, position: ((last as { position: number } | null)?.position ?? -1) + 1 }).select("id").single();
  if (error || !data) return FAIL();
  const id = (data as { id: string }).id;
  if (p.tags.length) await setTags(c, id, p.tags);
  if (p.row.follow_up_on) await toFollowUpSet(c, id);
  return freshB(c);
}
export async function updateCard(id: string, v: CardInput): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const p = card(v); if (!p.ok) return p;
  await setTags(c, id, p.tags);
  const { data: before } = await c.supabase.from("lead_cards").select("follow_up_on").eq("id", id).maybeSingle();
  const { error } = await c.supabase.from("lead_cards").update(p.row).eq("id", id);
  if (error) return FAIL();
  if (p.row.follow_up_on && p.row.follow_up_on !== (before as { follow_up_on: string | null } | null)?.follow_up_on) await toFollowUpSet(c, id);
  return freshB(c);
}
export async function deleteCard(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("lead_cards").delete().eq("id", id);
  return error ? FAIL() : freshB(c);
}
/** Puts a card in a list at a place (0 = top) and renumbers that list. */
export async function moveCard(id: string, listId: string, index: number): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id) || !UUID.test(listId)) return FAIL();
  const { data } = await c.supabase.from("lead_cards").select("id").eq("list_id", listId).is("affiliated_at", null).neq("id", id).order("position");
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  ids.splice(Math.max(0, Math.min(ids.length, Math.floor(Number(index) || 0))), 0, id);
  for (let i = 0; i < ids.length; i++) {
    const r = await c.supabase.from("lead_cards").update(ids[i] === id ? { list_id: listId, position: i } : { position: i }).eq("id", ids[i]);
    if (r.error) return FAIL();
  }
  return freshB(c);
}
/** "Registered for the Portal": the card jumps to that list on the Leads in the FLC Portal board. */
export async function registerCard(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { data, error } = await c.supabase.rpc("lead_register_in_portal", { p_card: id });
  return error ? FAIL() : freshB(c, String(data));
}
/** "Affiliated": the card becomes a team member. Returns where to go. */
export async function affiliateCard(id: string, rank: string): Promise<{ ok: true; teamId: string } | { ok: false; error: string }> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const r = (TEAM_RANKS as readonly string[]).includes(rank) ? rank : "1A";
  const { data, error } = await c.supabase.rpc("lead_affiliated", { p_card: id, p_rank: r });
  return error ? FAIL() : { ok: true, teamId: String(data) };
}

/* tags */
export async function addTag(name: string, color: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; const n = clean(name, 40);
  if (!n) return FAIL("Give the tag a name.");
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return FAIL("Choose a colour.");
  const { error } = await c.supabase.from("lead_tags").insert({ user_id: c.me, name: n, color });
  return error ? FAIL() : freshB(c);
}
export async function deleteTag(id: string): Promise<Boards> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { error } = await c.supabase.from("lead_tags").delete().eq("id", id).is("system_key", null);
  return error ? FAIL() : freshB(c);
}

/** Undo and redo: puts the boards back exactly as the given snapshot (cards that were deleted come back, with their tags). */
export async function restoreBoards(target: Board[]): Promise<Boards> {
  const c = await ctx(); if (!c) return NO;
  const boards = (Array.isArray(target) ? target : []).slice(0, 30);
  const lists = boards.flatMap((b) => (b.lists ?? []).slice(0, 60).map((l, i) => ({ b, l, i })));
  const cards = lists.flatMap(({ l }) => (l.cards ?? []).slice(0, 1000).map((cd, i) => ({ l, cd, i }))).slice(0, 3000);
  const ok = boards.every((b) => UUID.test(b.id)) && lists.every(({ l }) => UUID.test(l.id)) && cards.every(({ cd }) => UUID.test(cd.id));
  if (!ok) return FAIL("Something went wrong.");
  const { data: have } = await c.supabase.from("lead_tags").select("id");
  const tagIds = new Set(((have ?? []) as { id: string }[]).map((t) => t.id));
  const keepB = boards.map((b) => b.id), keepL = lists.map(({ l }) => l.id), keepC = cards.map(({ cd }) => cd.id);
  const { data: curB } = await c.supabase.from("lead_boards").select("id");
  const { data: curL } = await c.supabase.from("lead_lists").select("id");
  const { data: curC } = await c.supabase.from("lead_cards").select("id").is("affiliated_at", null);
  const gone = (cur: unknown, keep: string[]) => ((cur ?? []) as { id: string }[]).map((r) => r.id).filter((x) => !keep.includes(x));
  for (const [table, ids] of [["lead_cards", gone(curC, keepC)], ["lead_lists", gone(curL, keepL)], ["lead_boards", gone(curB, keepB)]] as const) {
    if (ids.length) { const r = await c.supabase.from(table).delete().in("id", ids); if (r.error) return FAIL(); }
  }
  const rb = await c.supabase.from("lead_boards").upsert(boards.map((b, i) => ({ id: b.id, user_id: c.me, name: clean(b.name, 80) || "Board", kind: b.kind === "leads" || b.kind === "portal" ? b.kind : null, position: i })), { onConflict: "id" });
  if (rb.error) return FAIL();
  const rl = await c.supabase.from("lead_lists").upsert(lists.map(({ b, l, i }) => ({ id: l.id, board_id: b.id, user_id: c.me, name: clean(l.name, 80) || "List", kind: l.kind === "registered" ? l.kind : null, position: i })), { onConflict: "id" });
  if (rl.error) return FAIL();
  for (const { l, cd, i } of cards) {
    const day = cd.followUp && /^\d{4}-\d{2}-\d{2}$/.test(cd.followUp) ? cd.followUp : null;
    await setTags(c, cd.id, []);
    const r = await c.supabase.from("lead_cards").upsert({ id: cd.id, list_id: l.id, user_id: c.me, name: clean(cd.name, 80) || "Lead", email: clean(cd.email, 254) || null, phone: clean(cd.phone, 40) || null, note: clean(cd.note, 1000) || null, instagram: clean(cd.instagram, 60) || null, facebook: clean(cd.facebook, 80) || null, follow_up_on: day, follow_up_days: Math.min(365, Math.max(1, Math.round(Number(cd.followDays)) || 3)), position: i }, { onConflict: "id" });
    if (r.error) return FAIL();
    const mine = (cd.tags ?? []).filter((t) => tagIds.has(t));
    if (mine.length) await c.supabase.from("lead_card_tags").insert(mine.map((t) => ({ card_id: cd.id, tag_id: t })));
  }
  return freshB(c);
}

/* ---------------------------------------------------------------- team */
const freshTeam = async (c: NonNullable<Awaited<ReturnType<typeof ctx>>>): Promise<Team> => ({ ok: true, team: await loadTeam(c.supabase) });
export async function getTeam(): Promise<Team> { const c = await ctx(); return c ? freshTeam(c) : NO; }

export type LeadOption = { key: string; name: string; email: string | null; cardId: string | null };
/** Every lead the person has (on their boards, who filled in their page, or who they invited), A to Z. */
export async function teamLeadOptions(): Promise<LeadOption[]> {
  const c = await ctx(); if (!c) return [];
  const [{ data: cards }, { data: forms }, { data: inv }] = await Promise.all([
    c.supabase.from("lead_cards").select("id, name, email").is("affiliated_at", null).limit(3000),
    c.supabase.rpc("my_leads", { p_from: "2020-01-01T00:00:00Z", p_to: new Date(Date.now() + 86_400_000).toISOString() }),
    c.supabase.rpc("my_invites"),
  ]);
  const out = new Map<string, LeadOption>();
  const put = (name: string, email: string | null, cardId: string | null) => {
    const key = email ? email.toLowerCase() : `card:${cardId}`;
    const have = out.get(key);
    if (!have) out.set(key, { key, name: name.trim() || email || "Unnamed lead", email, cardId });
    else if (cardId && !have.cardId) have.cardId = cardId;
  };
  for (const x of (cards ?? []) as { id: string; name: string; email: string | null }[]) put(x.name, x.email, x.id);
  for (const x of (forms ?? []) as { email: string; first_name: string | null; last_name: string | null }[]) put([x.first_name, x.last_name].filter(Boolean).join(" "), x.email, null);
  for (const x of (inv ?? []) as { email: string; first_name: string | null; last_name: string | null }[]) put([x.first_name, x.last_name].filter(Boolean).join(" "), x.email, null);
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** Adds someone to the team. If they have no portal account yet, they are emailed an invitation to create one. */
export async function addToTeam(v: { name: string; email: string; cardId?: string | null; rank?: string }): Promise<{ ok: true; team: TeamMember[]; message: string } | { ok: false; error: string }> {
  const c = await ctx(); if (!c) return NO;
  const name = clean(v.name, 80), email = clean(v.email, 254);
  if (!name) return FAIL("Give your team member a name.");
  if (email && !EMAIL.test(email)) return FAIL("That email address does not look right.");
  const rank = (TEAM_RANKS as readonly string[]).includes(v.rank ?? "") ? v.rank! : "1A";
  const card = v.cardId && UUID.test(v.cardId) ? v.cardId : null;
  const { data, error } = await c.supabase.rpc("team_add_member", { p_name: name, p_email: email || null, p_rank: rank, p_card: card });
  const row = (data as { id: string; needs_invite: boolean }[] | null)?.[0];
  if (error || !row) return FAIL();
  let message = `${name} is on your team.`;
  if (row.needs_invite) {
    const r = await c.supabase.rpc("invite_team_member", { p_member: row.id });
    if (r.error) message = `${name} is on your team, but we could not send the invitation. Try again in a moment.`;
    else if (r.data === "invited") {
      const sent = await sendLoginEmail(email);
      message = sent ? `${name} is on your team, and we emailed ${email} an invitation to create their account.` : `${name} is on your team and can create an account with ${email}, but we could not email them. Ask them to open the portal and enter that email.`;
    }
  }
  return { ok: true, team: await loadTeam(c.supabase), message };
}

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

/** Emails a team member who is not in the portal an invitation to create their account. */
export async function inviteTeamMember(id: string): Promise<{ ok: true; team: TeamMember[]; message: string } | { ok: false; error: string }> {
  const c = await ctx(); if (!c) return NO; if (!UUID.test(id)) return FAIL();
  const { data: m } = await c.supabase.from("team_members").select("name, email").eq("id", id).maybeSingle();
  const row = m as { name: string; email: string | null } | null;
  if (!row?.email) return FAIL("Add their email address first so we can invite them.");
  const r = await c.supabase.rpc("invite_team_member", { p_member: id });
  if (r.error) return FAIL("We could not send the invitation. Please try again.");
  if (r.data === "exists") return { ok: true, team: await loadTeam(c.supabase), message: `${row.name} already has an account in the portal.` };
  const sent = await sendLoginEmail(row.email);
  return { ok: true, team: await loadTeam(c.supabase), message: sent ? `We emailed ${row.email} an invitation to create their account.` : `${row.name} can create an account with ${row.email}, but we could not email them.` };
}
