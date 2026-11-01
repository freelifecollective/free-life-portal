import { describe, expect, it } from "vitest";
import { cleanLayout, DEFAULT_LAYOUT } from "../layout";

describe("graphic layouts", () => {
  it("keeps a good layout as it is", () => {
    expect(cleanLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
  });
  it("fills in anything missing", () => {
    const l = cleanLayout({});
    expect(l.photo.on).toBe(false);
    expect(l.name.color).toBe("#FFFFFF");
    expect(l.text.default).toBe("");
  });
  it("pulls numbers back into range and refuses bad colours", () => {
    const l = cleanLayout({ photo: { on: true, x: 500, y: -4, size: 999, shape: "star" }, name: { on: true, x: 5, y: 5, size: 0, color: "red; background:url(x)", align: "justify" } });
    expect(l.photo).toMatchObject({ x: 100, y: 0, size: 80, shape: "circle" });
    expect(l.name).toMatchObject({ size: 1, color: "#FFFFFF", align: "center" });
  });
  it("shortens a long default text", () => {
    expect(cleanLayout({ text: { on: true, default: "x".repeat(300) } }).text.default).toHaveLength(140);
  });
});
