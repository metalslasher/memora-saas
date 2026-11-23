import { describe, expect, it } from "vitest";
import { isKnownWord, knownWordForms, pickedPhrases, tokenizeText } from "./text-pick";

describe("text picking", () => {
  const text = "I couldn't figure out the bill. Then it worked!\nWe ran home.";
  const tokens = tokenizeText(text);
  const indexOf = (word: string) => tokens.findIndex((token) => token.isWord && token.text === word);

  it("keeps the text intact and marks words", () => {
    expect(tokens.map((token) => token.text).join("")).toBe(text);
    expect(tokens.filter((token) => token.isWord).map((token) => token.text)).toContain("couldn't");
  });

  it("joins adjacent tapped words into one phrase with its sentence", () => {
    const phrases = pickedPhrases(tokens, new Set([indexOf("figure"), indexOf("out"), indexOf("ran")]));
    expect(phrases.map((phrase) => phrase.input)).toEqual(["figure out", "ran"]);
    expect(phrases[0].context).toBe("I couldn't figure out the bill.");
    expect(phrases[1].context).toBe("We ran home.");
  });

  it("does not join words across punctuation and drops repeats", () => {
    const repeated = tokenizeText("bill, bill");
    const words = repeated.flatMap((token, index) => (token.isWord ? [index] : []));
    expect(pickedPhrases(repeated, new Set(words)).map((phrase) => phrase.input)).toEqual(["bill"]);
  });

  it("recognizes forms of library words", () => {
    const known = knownWordForms(["run", "work", "figure out"]);
    expect(isKnownWord("ran", known)).toBe(true);
    expect(isKnownWord("Worked", known)).toBe(true);
    expect(isKnownWord("figure", known)).toBe(false);
  });
});
