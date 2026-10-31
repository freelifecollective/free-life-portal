import { describe, expect, it } from "vitest";
import { buildDict, norm, translateDates, translateText, type Entry } from "../match";

const E: Entry[] = [
  ["Calendar", "Calendario", "Calendrier", "Calendario", "Kalender"],
  ["Don't worry", "No te preocupes", "Pas de souci", "Non preoccuparti", "Keine Sorge"],
  ["Question {0} of {1}", "Pregunta {0} de {1}", "Question {0} sur {1}", "Domanda {0} di {1}", "Frage {0} von {1}"],
  ["{0} coming live", "{0} vienen en vivo", "{0} en direct", "{0} dal vivo", "{0} live dabei"],
];

describe("translateText", () => {
  const es = buildDict(E, "es");
  it("finds exact text and keeps the spacing around it", () => expect(translateText("  Calendar ", es)).toBe("  Calendario "));
  it("ignores quote style", () => expect(translateText("Don’t   worry", es)).toBe("No te preocupes"));
  it("fills in patterns", () => expect(translateText("Question 3 of 26", es)).toBe("Pregunta 3 de 26"));
  it("leaves unknown text alone", () => expect(translateText("Sonya Ruthven", es)).toBeNull());
  it("does not touch numbers or symbols", () => expect(translateText("42", es)).toBeNull());
  it("a pattern can start with the number", () => expect(translateText("12 coming live", es)).toBe("12 vienen en vivo"));
});

describe("translateDates", () => {
  it("Spanish short date", () => expect(translateDates("Mon, Nov 2, 5:30 PM EST", "es")).toBe("lun, 2 nov, 5:30 PM EST"));
  it("German long date", () => expect(translateDates("September 6, 1991", "de")).toBe("6. September, 1991"));
  it("Spanish long date", () => expect(translateDates("September 6, 1991", "es")).toBe("6 de septiembre, 1991"));
  it("French", () => expect(translateDates("last seen Oct 12", "fr")).toBe("last seen 12 oct."));
  it("plain sentences are left alone", () => expect(translateDates("You may go", "es")).toBeNull());
});

describe("norm", () => { it("collapses", () => expect(norm("a   b")).toBe("a b")); });
