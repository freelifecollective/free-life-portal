import { describe, expect, it } from "vitest";
import { toEmbedUrl } from "../video";

describe("toEmbedUrl", () => {
  it("Vimeo page link", () => expect(toEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789"));
  it("unlisted Vimeo link keeps its key", () => expect(toEmbedUrl("https://vimeo.com/123456789/abc123def0")).toBe("https://player.vimeo.com/video/123456789?h=abc123def0"));
  it("Vimeo player link", () => expect(toEmbedUrl("https://player.vimeo.com/video/123456789?h=abc123")).toBe("https://player.vimeo.com/video/123456789?h=abc123"));
  it("YouTube watch link", () => expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"));
  it("YouTube short link", () => expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"));
  it("YouTube Shorts", () => expect(toEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"));
  it("other sites are refused", () => expect(toEmbedUrl("https://example.com/video/123456")).toBeNull());
  it("not a link", () => expect(toEmbedUrl("my video")).toBeNull());
});
