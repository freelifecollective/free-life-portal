import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../questions";
import { cleanAnswers, firstIncomplete, isComplete, isValid, rankId } from "../validate";

const q = (k: string) => QUESTIONS.find((x) => x.k === k)!;
describe("questionnaire rules", () => {
  it("has the 26 approved questions with unique keys", () => {
    expect(QUESTIONS).toHaveLength(26);
    expect(new Set(QUESTIONS.map((x) => x.k)).size).toBe(26);
  });
  it("limits multi-select answers", () => {
    expect(isValid(q("goals"), ["Leave my job", "Travel the world"])).toBe(true);
    expect(isValid(q("goals"), q("goals").o!.slice(0, 4))).toBe(false);
  });
  it("treats exclusive options as exclusive", () => {
    expect(isValid(q("kids"), ["No kids"])).toBe(true);
    expect(isValid(q("kids"), ["No kids", "I have teenagers"])).toBe(false);
    expect(isValid(q("derail"), ["All of the above"])).toBe(true);
    expect(isValid(q("derail"), ["All of the above", "Confidence"])).toBe(false);
  });
  it("accepts age as a number or prefer-not-to-answer only", () => {
    expect(isValid(q("age"), 32)).toBe(true);
    expect(isValid(q("age"), 17)).toBe(false);
    expect(isValid(q("age"), "Prefer not to answer")).toBe(true);
    expect(isValid(q("age"), "old")).toBe(false);
  });
  it("needs a few words for text answers", () => {
    expect(isValid(q("about"), "short")).toBe(false);
    expect(isValid(q("about"), "A sentence about me.")).toBe(true);
  });
  it("needs a city with a time zone", () => {
    expect(isValid(q("tz"), { city: "Toronto, Canada", tz: "America/Toronto" })).toBe(true);
    expect(isValid(q("tz"), { city: "Toronto" })).toBe(false);
  });
  it("drops answers that no longer fit, and maps ranks", () => {
    expect(cleanAnswers({ chrono: "Night owl", checkin: "Hourly" })).toEqual({ chrono: "Night owl" });
    expect(isComplete({})).toBe(false);
    expect(firstIncomplete({})).toBe(0);
    expect(rankId("3A")).toBe(3);
    expect(rankId("6A+")).toBe(7);
    expect(rankId("9Z")).toBeNull();
  });
});
