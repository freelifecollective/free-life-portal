import { describe, expect, it } from "vitest";
import { dropBusy } from "./busy";

const t = (s: string) => new Date(s).getTime();
describe("dropBusy", () => {
  const slots = ["2026-11-10T14:00:00Z", "2026-11-10T14:30:00Z", "2026-11-10T15:00:00Z", "2026-11-10T16:00:00Z"];
  it("keeps everything when nothing is busy", () => { expect(dropBusy(slots, [], 30)).toEqual(slots); });
  it("removes a call that overlaps a busy stretch", () => {
    const busy = [{ start: t("2026-11-10T14:15:00Z"), end: t("2026-11-10T15:00:00Z") }];
    expect(dropBusy(slots, busy, 30)).toEqual(["2026-11-10T15:00:00Z", "2026-11-10T16:00:00Z"]);
  });
  it("lets a call start exactly when something ends, or end exactly when something starts", () => {
    const busy = [{ start: t("2026-11-10T14:30:00Z"), end: t("2026-11-10T15:00:00Z") }];
    expect(dropBusy(slots, busy, 30)).toEqual(["2026-11-10T14:00:00Z", "2026-11-10T15:00:00Z", "2026-11-10T16:00:00Z"]);
  });
  it("uses the length of the call", () => {
    const busy = [{ start: t("2026-11-10T14:45:00Z"), end: t("2026-11-10T15:15:00Z") }];
    expect(dropBusy(slots, busy, 60)).toEqual(["2026-11-10T16:00:00Z"]);
  });
});
