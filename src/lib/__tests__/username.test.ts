import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_USERNAMES, checkUsernameFormat, makeUsername, slug } from "../username";

describe("slug", () => {
  it("lowercases, strips accents and symbols", () => {
    expect(slug("Zoë O'Brien-Ñuñez")).toBe("zoeobriennunez");
  });
});

describe("checkUsernameFormat", () => {
  it("accepts good names", () => {
    expect(checkUsernameFormat("sarah_chen-2")).toEqual({ ok: true });
  });
  it("is case-insensitive", () => {
    expect(checkUsernameFormat("SarahChen")).toEqual({ ok: true });
  });
  it.each([
    ["ab", "too_short"],
    ["a".repeat(31), "too_long"],
    ["bad name", "bad_chars"],
    ["emoji😀name", "bad_chars"],
    ["admin", "reserved"],
    ["Welcome", "reserved"],
  ])("rejects %s", (name, reason) => {
    expect(checkUsernameFormat(name)).toEqual({ ok: false, reason });
  });
});

describe("makeUsername", () => {
  it("joins first and last name", () => {
    expect(makeUsername("Maya", "Patel", () => false)).toBe("mayapatel");
  });
  it("adds a number when taken", () => {
    const taken = new Set(["mayapatel", "mayapatel2"]);
    expect(makeUsername("Maya", "Patel", (u) => taken.has(u))).toBe("mayapatel3");
  });
  it("never suggests a reserved name", () => {
    expect(makeUsername("Ad", "Min", () => false)).toBe("admin2");
  });
  it("falls back to member + digits when the name has no usable letters", () => {
    expect(makeUsername("李", "雷", () => false, () => 0)).toBe("member1000");
  });
  it("caps the base at 26 characters so a number still fits in 30", () => {
    const u = makeUsername("a".repeat(30), "b".repeat(30), () => false);
    expect(u.length).toBe(26);
  });
});

describe("reserved list", () => {
  it("matches the database seed exactly (all migrations together)", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const inDb = new Set<string>();
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(join(dir, f), "utf8");
      for (const m of sql.matchAll(/insert into public\.reserved_usernames \(username\) values([\s\S]*?)(?:on conflict do nothing)?;/g)) {
        for (const v of m[1].matchAll(/\('([a-z0-9_-]+)'\)/g)) inDb.add(v[1]);
      }
    }
    expect([...RESERVED_USERNAMES].sort()).toEqual([...inDb].sort());
  });
  it("covers every top-level page of the site", () => {
    const pages = ["admin", "login", "auth", "logout", "calendar", "register", "welcome", "api"];
    for (const p of pages) expect(RESERVED_USERNAMES as readonly string[]).toContain(p);
  });
});
