import { describe, expect, it } from "vitest";
import { canvaEmbedUrl, isCanvaLink } from "./canva";

describe("canvaEmbedUrl", () => {
  it("turns a share link into the embed view", () => {
    expect(canvaEmbedUrl("https://www.canva.com/design/DAF123abc/Tok_en-9/view?utm_content=x")).toBe("https://www.canva.com/design/DAF123abc/Tok_en-9/view?embed");
    expect(canvaEmbedUrl("https://www.canva.com/design/DAF123abc/Tok_en-9/edit")).toBe("https://www.canva.com/design/DAF123abc/Tok_en-9/view?embed");
  });
  it("leaves other links alone", () => {
    expect(canvaEmbedUrl("https://www.canva.com/templates/EAF/")).toBeNull();
    expect(canvaEmbedUrl("https://evil.example/design/a/b/view")).toBeNull();
    expect(isCanvaLink("https://canva.link/abc")).toBe(true);
    expect(isCanvaLink("https://example.com/canva.com/x")).toBe(false);
  });
});
