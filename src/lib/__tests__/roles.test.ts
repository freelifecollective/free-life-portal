import { describe, expect, it } from "vitest";
import { canSee } from "../roles";

describe("canSee", () => {
  it("lead < member < admin", () => {
    expect(canSee("lead", "lead")).toBe(true);
    expect(canSee("lead", "member")).toBe(false);
    expect(canSee("member", "member")).toBe(true);
    expect(canSee("member", "admin")).toBe(false);
    expect(canSee("admin", "lead")).toBe(true);
  });
  it("nobody signed in sees nothing", () => {
    expect(canSee(null, "lead")).toBe(false);
    expect(canSee(undefined, "lead")).toBe(false);
  });
});
