import { expect, it } from "vitest";
import { buildDict, translateText } from "../match";
import { ENTRIES } from "../entries";

it("translates a whole birthday line", () => {
  expect(translateText("September 6, 1991 (35 years old)", buildDict(ENTRIES, "it"))).toBe("6 settembre, 1991 (35 anni)");
  expect(translateText("September 6", buildDict(ENTRIES, "de"))).toBe("6. September");
});
