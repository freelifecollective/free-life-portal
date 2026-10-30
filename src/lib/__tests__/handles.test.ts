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

describe("facebook links", () => {
  it("keeps a business page link with a number tail", () =>
    expect(cleanHandle("https://www.facebook.com/MyBusiness-100012345678/?ref=share", "facebook")).toBe("https://www.facebook.com/MyBusiness-100012345678"));
  it("keeps a profile.php link", () =>
    expect(cleanHandle("facebook.com/profile.php?id=61555555555&sk=about", "facebook")).toBe("https://www.facebook.com/profile.php?id=61555555555"));
  it("keeps a pages link", () =>
    expect(cleanHandle("https://m.facebook.com/pages/My-Page/123456789", "facebook")).toBe("https://www.facebook.com/pages/My-Page/123456789"));
  it("links are accepted", () => expect(handleState("https://www.facebook.com/MyBusiness-100012345678", "facebook")).toBe("ok"));
  it("other sites are rejected", () => expect(handleState("https://evil.example.com/MyBusiness", "facebook")).toBe("bad"));
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
