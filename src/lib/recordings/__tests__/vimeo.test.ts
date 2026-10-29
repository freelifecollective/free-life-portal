import { describe, expect, it } from "vitest";
import { formatTime, parseTime, parseVimeo } from "../vimeo";

describe("vimeo links", () => {
  it("reads a plain link", () => expect(parseVimeo("https://vimeo.com/123456789")).toEqual({ id: "123456789", hash: null }));
  it("reads a private link with a hash", () => expect(parseVimeo("https://vimeo.com/123456789/AbC123def4")).toEqual({ id: "123456789", hash: "abc123def4" }));
  it("reads a player link", () => expect(parseVimeo("https://player.vimeo.com/video/123456789?h=abc123def4&x=1")).toEqual({ id: "123456789", hash: "abc123def4" }));
  it("rejects other sites and junk", () => { expect(parseVimeo("https://youtube.com/watch?v=123456789")).toBeNull(); expect(parseVimeo("not a link")).toBeNull(); expect(parseVimeo("https://vimeo.com/channels/staffpicks")).toBeNull(); });
});
describe("times", () => {
  it("parses minutes and hours", () => { expect(parseTime("12:30")).toBe(750); expect(parseTime("1:05:30")).toBe(3930); expect(parseTime("90")).toBe(90); expect(parseTime("")).toBeNull(); expect(parseTime("a:b")).toBeUndefined(); });
  it("formats them back", () => { expect(formatTime(750)).toBe("12:30"); expect(formatTime(3930)).toBe("1:05:30"); expect(formatTime(null)).toBe(""); });
});
