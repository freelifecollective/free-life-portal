// Live check against a real Supabase project, using throwaway anonymous visitors (no email, no passwords).
// Needs: the app running (npm run dev), .env.local filled in, and "Allow anonymous sign-ins" switched on in Supabase.
// It runs the first-login flow in a browser as visitor A, then checks the access rules as visitor B.
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

/* ---- visitor A: sign in the way the app does, and keep the cookies it would set */
const jar = [];
const sbA = createServerClient(URL_, KEY, { cookies: { getAll: () => jar.map(({ name, value }) => ({ name, value })), setAll: (l) => l.forEach((c) => { const i = jar.findIndex((x) => x.name === c.name); if (i >= 0) jar.splice(i, 1); jar.push(c); }) } });
const a = await sbA.auth.signInAnonymously();
if (a.error) { console.log("Could not sign in anonymously:", a.error.message); process.exit(2); }
const A = a.data.user.id;
ok(!!A && a.data.user.is_anonymous, "visitor A signed in (anonymous)");
const prof0 = await sbA.from("profiles").select("*").eq("id", A).single();
ok(prof0.data?.role === "lead" && prof0.data.onboarded_at === null, "a profile row was created automatically, role lead, not onboarded");

/* ---- the first-login flow in a real browser, against the live project */
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
await ctx.addCookies(jar.map((c) => ({ name: c.name, value: c.value, url: BASE })));
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const uname = `livetest-${rand}`;

await p.goto(BASE + "/");
await p.waitForURL(/\/welcome/);
ok(true, "signed in, not onboarded: / sends visitor A to /welcome");
await p.waitForSelector(".fl-welcome"); await p.click(".fl-welcome .skip"); await p.waitForSelector("#first");
await p.fill("#first", "Live"); await p.fill("#last", "Tester");
await p.click("text=Continue");
await p.waitForSelector("#uname");
await p.waitForFunction(() => document.querySelector("#uname-status")?.textContent === "Available", null, { timeout: 15000 });
ok((await p.inputValue("#uname")) === "livetester", "username suggested and confirmed free by the live database");
await p.fill("#uname", "admin");
await p.waitForFunction(() => /reserved/.test(document.querySelector("#uname-status")?.textContent ?? ""));
ok(true, "'admin' is refused as reserved");
await p.fill("#uname", uname);
await p.waitForFunction(() => document.querySelector("#uname-status")?.textContent === "Available", null, { timeout: 15000 });
await p.click("text=Accept username");
await p.waitForSelector("#ig");
await p.fill("#ig", "live_tester"); await p.locator("#ig").blur();
await p.click("text=Continue");
await p.waitForSelector("text=Add your profile picture");
await p.click("text=Create an avatar instead");
await p.waitForSelector("text=Let’s style your picture");
await p.click("button[role=radio]:has-text('Fancy outline')"); await p.click("button[role=radio]:has-text('Texture')");
await p.click("text=Create my pictures");
await p.waitForSelector(".grid .opt"); await p.locator(".grid .opt").nth(1).click();
await p.waitForSelector("text=Lookin good!");
await p.click("button:has-text('Done')");
await p.waitForSelector("text=You’re in, Live.", { timeout: 20000 });
ok(true, "picture uploaded and profile saved without an error");
await p.click("text=Go to the portal");
await p.waitForSelector("text=Welcome, Live", { timeout: 15000 });
ok(true, "visitor A lands in the portal");
const headerImg = await p.locator(".app-top img.avatar").first().getAttribute("src").catch(() => null);
ok(!!headerImg && headerImg.includes("/storage/v1/object/public/avatars/" + A + "/"), "header shows the picture from Supabase storage");
const shown = await p.waitForFunction(() => { const i = document.querySelector(".app-top img.avatar"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
ok(shown, "the picture actually displays in the header (loads from Supabase storage)");
await p.screenshot({ path: process.env.SHOT ?? "/tmp/live-portal.png" });
await p.goto(BASE + "/welcome"); await p.waitForURL(BASE + "/", { timeout: 10000 });
ok(true, "finished visitor is sent from /welcome to the portal");
ok(errors.length === 0, "no browser errors " + errors.join(" | "));
await browser.close();

/* ---- what was stored */
const prof = (await sbA.from("profiles").select("*").eq("id", A).single()).data;
ok(prof.onboarded_at && prof.first_name === "Live" && prof.username === uname && prof.instagram === "live_tester" && prof.avatar_kind === "monogram", "profile row holds the saved answers");
ok(prof.avatar_url?.startsWith(`${URL_}/storage/v1/object/public/avatars/${A}/`), "avatar_url points into visitor A's own folder");
const img = await fetch(prof.avatar_url);
ok(img.status === 200 && /image\/jpeg/.test(img.headers.get("content-type") ?? "") && (await img.arrayBuffer()).byteLength > 5000, "the stored picture is publicly viewable and a real JPEG");
const noAuthPublic = await fetch(prof.avatar_url, { headers: {} });
ok(noAuthPublic.status === 200, "anyone can load an avatar by its address");

/* ---- visitor B: the access rules from outside */
const B = createClient(URL_, KEY, { auth: { persistSession: false } });
const b = await B.auth.signInAnonymously();
const Bid = b.data.user.id;
ok(!!Bid && Bid !== A, "visitor B signed in");
ok(((await B.from("profiles").select("id")).data ?? []).length === 1, "B can read only their own profile row");
ok(((await B.from("profiles").select("id").eq("id", A)).data ?? []).length === 0, "B cannot read A's profile row");
const cards = await B.from("profile_cards").select("*");
const card = cards.data?.find((c) => c.id === A);
ok(!!card && card.username === uname && Object.keys(card).sort().join() === "avatar_url,facebook,first_name,id,instagram,username", "B sees A only as a limited card (name, username, picture, handles)");
ok((await B.rpc("check_username", { candidate: uname })).data?.reason === "taken", "A's username shows as taken to B");
ok((await B.rpc("check_username", { candidate: "portal" })).data?.reason === "reserved", "reserved name is refused by the database");
ok((await B.from("reserved_usernames").select("*")).data?.length === 0, "B cannot read the reserved list");
ok((await B.from("ranks").select("name").order("sort")).data?.map((r) => r.name).join() === "1A,2A,3A,4A,5A,6A,6A+", "ranks are readable and in order");
const esc = await B.from("profiles").update({ role: "admin" }).eq("id", Bid);
ok(!!esc.error && esc.error.code === "42501", "B cannot make themselves admin (" + (esc.error?.code ?? "no error") + ")");
const steal = await B.from("profiles").update({ username: uname }).eq("id", Bid);
ok(!!steal.error && steal.error.code === "23505", "B cannot take A's username (" + (steal.error?.code ?? "no error") + ")");
const bad = await B.from("profiles").update({ username: "admin" }).eq("id", Bid);
ok(!!bad.error && bad.error.code === "23514", "B cannot take a reserved name (" + (bad.error?.code ?? "no error") + ")");
const hijack = await B.from("profiles").update({ first_name: "Hacked" }).eq("id", A).select();
ok((hijack.data ?? []).length === 0, "B cannot edit A's profile");
const into = await B.storage.from("avatars").upload(`${A}/evil.jpg`, new Blob([new Uint8Array(2000)], { type: "image/jpeg" }), { contentType: "image/jpeg" });
ok(!!into.error, "B cannot upload into A's folder (" + (into.error?.message ?? "no error") + ")");
const own = await B.storage.from("avatars").upload(`${Bid}/avatar.jpg`, new Blob([new Uint8Array(2000)], { type: "image/jpeg" }), { contentType: "image/jpeg" });
ok(!own.error, "B can upload into B's own folder");
const wrongType = await B.storage.from("avatars").upload(`${Bid}/x.txt`, new Blob(["hello"], { type: "text/plain" }), { contentType: "text/plain" });
ok(!!wrongType.error, "only images are accepted (" + (wrongType.error?.message ?? "no error") + ")");
const big = await B.storage.from("avatars").upload(`${Bid}/big.jpg`, new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/jpeg" }), { contentType: "image/jpeg" });
ok(!!big.error, "pictures over 2 MB are refused (" + (big.error?.message ?? "no error") + ")");
const delA = await B.storage.from("avatars").remove([`${A}/avatar.jpg`]);
ok((delA.data ?? []).length === 0, "B cannot delete A's picture");

/* ---- clean up what we can (visitors themselves are removed in the dashboard) */
await B.storage.from("avatars").remove([`${Bid}/avatar.jpg`]);
await sbA.storage.from("avatars").remove([`${A}/avatar.jpg`]);
console.log(`\nTest visitors to delete in Supabase (Authentication > Users): ${A} and ${Bid}`);
console.log(failed ? `${failed} CHECK(S) FAILED` : "ALL LIVE CHECKS PASSED");
process.exit(failed ? 1 : 0);
