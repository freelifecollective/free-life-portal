import { expect, it } from "vitest";
import { buildDict, translateText } from "../match";
import { ENTRIES } from "../entries";

it("translates what notifications say", () => {
  const it_ = buildDict(ENTRIES, "it");
  expect(translateText("New call: Mastermind Call", it_)).toBe("Nuova chiamata: Chiamata Mastermind");
  expect(translateText("Sonya Ruthven sent you a message", it_)).toBe("Sonya Ruthven ti ha mandato un messaggio");
  expect(translateText("Free Life Community Call starts in 10 minutes", it_)).toBe("Free Life Community Call inizia tra 10 minuti");
  expect(translateText("4 of 5 stars: Great help", it_)).toBe("4 stelle su 5: Great help");
  expect(translateText("Your resource was approved!", it_)).toBe("La tua risorsa è stata approvata!");
  expect(translateText("Monday, Nov 3 at 4:00 PM ET", buildDict(ENTRIES, "de"))).toBe("Montag, 3. Nov. um 4:00 PM ET");
  expect(translateText("Hello from a member", it_)).toBeNull();
});
