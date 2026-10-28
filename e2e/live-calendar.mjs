// Live check of the calendar, RSVPs, registration and invite-only sign-up against the real Supabase project.
// Needs: the 0002 migration applied, supabase/seed/sample_calls.sql run, the app running, and
// Authentication > "Allow anonymous sign-ins" switched on while this runs (switch it off afterwards).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { createServerClient } = require("@supabase/ssr");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, BASE = process.env.BASE ?? "http://localhost:3000";
let failed = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failed++; };
const rand = Math.random().toString(36).slice(2, 8);
const fakeEmail = `livetest-${rand}@example.invalid`;

/* visitor A: an anonymous lead who has finished the welcome flow */
const jar = [];
const sbA = createServerClient(URL_, KEY, { cookies: { getAll: () => jar.map(({ name, value }) => ({ name, value })), setAll: (l) => l.forEach((c) => { const i = jar.findIndex((x) => x.name === c.name); if (i >= 0) jar.splice(i, 1); jar.push(c); }) } });
const a = await sbA.auth.signInAnonymously();
if (a.error) { console.log("Could not sign in anonymously:", a.error.message); process.exit(2); }
const A = a.data.user.id;
const prof = await sbA.from("profiles").update({ first_name: "Calendar", last_name: "Tester", username: `caltest-${rand}`, onboarded_at: new Date().toISOString() }).eq("id", A);
ok(!prof.error, "visitor A set up as a finished lead " + (prof.error?.message ?? ""));

const calls = (await sbA.from("calls").select("id,title,audience,pinned,starts_at")).data ?? [];
const open = calls.filter((c) => c.audience === "leads_open"), closed = calls.filter((c) => c.audience === "affiliates_only");
ok(open.length >= 1, `a lead sees the leads-open sample calls (${open.length})`);
ok(closed.length === 0, "a lead does not see the affiliates-only masterclass");
const featured = open.find((c) => c.pinned) ?? open[0];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
await ctx.addCookies(jar.map((c) => ({ name: c.name, value: c.value, url: BASE })));
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });

await p.goto(BASE + "/");
await p.waitForSelector("text=Welcome, Calendar");
ok(await p.locator("[aria-label='Next call']").isVisible(), "Home shows the next-call card");
ok(/RSVP on the calendar/i.test(await p.locator("[aria-label='Next call']").innerText()), "the card links to the calendar");

await p.click("text=Calendar >> nth=0");
await p.waitForSelector(".call-card");
ok(/Next call/i.test(await p.locator(".call-card.featured").innerText()), "the pinned call is featured at the top");
ok(!/affiliates only/i.test(await p.locator(".calendar").innerText()), "no affiliates-only call is listed for a lead");
const card = p.locator(".call-card.featured");
await card.getByRole("button", { name: "I'll be there live" }).click();
await card.getByRole("button", { name: "You're coming live" }).waitFor();
ok(true, "RSVP live: the button changes");
let s = (await sbA.rpc("call_rsvp_summary", { p_call: featured.id })).data;
ok(s.live === 1 && s.mine === "live", "RSVP live is saved in the database");
await p.reload(); await p.waitForSelector(".call-card.featured");
ok(await p.locator(".call-card.featured").getByRole("button", { name: "You're coming live" }).isVisible(), "and still there after a refresh");
ok(/1 coming live/.test(await p.locator(".call-card.featured .attendee-count").innerText()), "the tally says 1 coming live");
await p.locator(".call-card.featured").getByRole("button", { name: "I'll watch the recording" }).click();
await p.locator(".call-card.featured").getByRole("button", { name: "You'll watch the recording" }).waitFor();
s = (await sbA.rpc("call_rsvp_summary", { p_call: featured.id })).data;
ok(s.live === 0 && s.recording === 1 && s.mine === "recording", "switching to the recording moves the RSVP");
await p.locator(".call-card.featured").getByRole("button", { name: "You'll watch the recording" }).click();
await p.locator(".call-card.featured").getByRole("button", { name: "I'll watch the recording" }).waitFor();
await p.waitForFunction(() => /Be the first to RSVP/.test(document.querySelector(".call-card.featured")?.textContent ?? ""));
s = (await sbA.rpc("call_rsvp_summary", { p_call: featured.id })).data;
ok(s.live + s.recording === 0 && s.mine === null, "pressing it again takes the RSVP back");
ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scrolling");

/* admin pages are closed to a lead */
for (const path of ["/admin/calls", "/admin/people"]) {
  await p.goto(BASE + path);
  await p.waitForURL(BASE + "/");
  ok(true, `a lead who opens ${path} is sent home`);
}
ok(!/Manage calls|People and invites/.test(await p.locator(".nav").innerText()), "the admin menu is hidden from a lead");
ok(errors.length === 0, "no browser errors " + errors.join(" | "));
await ctx.close();

/* registration page: public, no account */
const anon = await browser.newContext({ viewport: { width: 420, height: 900 } });
const q = await anon.newPage();
const qerr = []; q.on("pageerror", (e) => qerr.push(e.message));
await q.goto(`${BASE}/register/${featured.id}`);
await q.waitForSelector("#name");
ok((await q.locator("h1").innerText()).includes("Sample") || (await q.locator("h1").innerText()).length > 3, "the registration page shows the call without signing in");
await q.fill("#name", "Live Test"); await q.fill("#email", "not-an-email");
await q.getByRole("button", { name: "Save my spot" }).click();
await q.waitForSelector("text=valid email");
ok(true, "a bad email is refused with a message");
await q.fill("#email", fakeEmail);
await q.getByRole("button", { name: "Save my spot" }).click();
await q.waitForSelector("text=tick the box");
ok(true, "consent is required");
await q.check("input[name=consent]");
await q.getByRole("button", { name: "Save my spot" }).click();
await q.waitForSelector("text=You’re registered", { timeout: 15000 }).catch(async () => q.waitForSelector("text=registered"));
ok(true, "registering works and says so");
await q.goto(`${BASE}/register/00000000-0000-0000-0000-000000000000`);
await q.waitForSelector("text=isn’t open").catch(() => {});
ok(/open/.test(await q.locator("h1").innerText()), "an unknown call says it is not open");
ok(qerr.length === 0, "no browser errors on the public page " + qerr.join(" | "));
await anon.close();
await browser.close();

/* invite-only sign-up, from outside */
const B = createClient(URL_, KEY, { auth: { persistSession: false } });
const stranger = await B.auth.signInWithOtp({ email: `stranger-${rand}@example.invalid` });
ok(!!stranger.error, "an email that was never invited cannot get an account (" + (stranger.error?.message ?? "no error") + ")");
const noAdmin = await B.from("signup_allowlist").insert({ email: `x-${rand}@example.invalid` });
ok(!!noAdmin.error, "the public cannot add themselves to the invite list");

/* tidy what we can */
await sbA.from("rsvps").delete().eq("user_id", A);
console.log(`\nTest leftovers to remove (run in the Supabase SQL editor):
  delete from public.registrations where email = '${fakeEmail}';
  delete from public.signup_allowlist where email = '${fakeEmail}';
  delete from public.email_outbox where to_email = '${fakeEmail}';
and delete the anonymous test visitor(s) in Authentication > Users (this run: ${A}).`);
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL LIVE CALENDAR CHECKS PASSED");
process.exit(failed ? 1 : 0);
