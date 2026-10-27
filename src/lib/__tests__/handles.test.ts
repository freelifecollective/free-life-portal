import { describe, expect, it } from "vitest";
import { cleanHandle, handleState } from "../handles";

describe("cleanHandle", () => {
  it("strips @", () => expect(cleanHandle("@maya_p", "instagram")).toBe("maya_p"));
  it("strips an instagram link", () =>
    expect(cleanHandle("https://www.instagram.com/maya_p/?hl=en", "instagram")).toBe("maya_p"));
  it("strips a facebook link", () =>
    expect(cleanHandle("facebook.com/maya.patel", "facebook")).toBe("maya.patel"));
  it("does not strip the wrong network's host", () =>
    expect(cleanHandle("facebook.com/maya", "instagram")).toBe("facebook.com"));
});

describe("handleState", () => {
  it("empty", () => expect(handleState("  ", "instagram")).toBe("empty"));
  it("instagram ok", () => expect(handleState("@maya_p", "instagram")).toBe("ok"));
  it("instagram too long", () => expect(handleState("a".repeat(31), "instagram")).toBe("bad"));
  it("instagram rejects spaces", () => expect(handleState("no spaces", "instagram")).toBe("bad"));
  it("facebook needs 5+ characters", () => expect(handleState("abcd", "facebook")).toBe("bad"));
  it("facebook rejects underscores", () => expect(handleState("maya_patel", "facebook")).toBe("bad"));
  it("facebook ok", () => expect(handleState("maya.patel", "facebook")).toBe("ok"));
});
