import { describe, expect, it } from "vitest";
import { findCloze } from "./cloze";
import { isSameLemma, phraseForms, wordForms } from "./word-forms";

describe("word forms", () => {
  it("builds regular forms with spelling rules", () => {
    expect([...wordForms("handle")]).toEqual(expect.arrayContaining(["handle", "handles", "handled", "handling"]));
    expect([...wordForms("try")]).toEqual(expect.arrayContaining(["tries", "tried", "trying"]));
    expect([...wordForms("stop")]).toEqual(expect.arrayContaining(["stops", "stopped", "stopping"]));
    expect([...wordForms("fix")]).toEqual(expect.arrayContaining(["fixes", "fixed", "fixing"]));
    expect([...wordForms("lie")]).toEqual(expect.arrayContaining(["lies", "lying", "lay", "lain"]));
  });

  it("knows common irregular verbs", () => {
    expect([...wordForms("come")]).toEqual(expect.arrayContaining(["came", "coming"]));
    expect([...wordForms("be")]).toEqual(expect.arrayContaining(["is", "was", "were", "been"]));
  });

  it("inflects the head of a phrase", () => {
    expect(phraseForms("look forward to").has("looking forward to")).toBe(true);
    expect(phraseForms("credit card").has("credit cards")).toBe(true);
    expect(isSameLemma("came up with", "come up with")).toBe(true);
    expect(isSameLemma("handle", "candle")).toBe(false);
  });
});

describe("findCloze", () => {
  it("blanks the word in an example", () => {
    expect(findCloze("reliable", "We need a more reliable way to track this.")).toEqual({
      text: "We need a more _____ way to track this.",
      answer: "reliable",
    });
  });

  it("finds inflected forms and keeps the form as the answer", () => {
    expect(findCloze("look forward to", "I'm really looking forward to the weekend.")).toEqual({
      text: "I'm really _____ the weekend.",
      answer: "looking forward to",
    });
    expect(findCloze("handle", "She handled it well.")?.answer).toBe("handled");
    expect(findCloze("deadline", "Both deadlines got pushed.")?.answer).toBe("deadlines");
  });

  it("handles separable phrasal verbs", () => {
    expect(findCloze("figure out", "I'm still trying to figure it out.")).toEqual({
      text: "I'm still trying to _____ it _____.",
      answer: "figure out",
    });
  });

  it("ignores a leading to/article in the lemma and matches whole words only", () => {
    expect(findCloze("to handle", "Can you handle this?")?.answer).toBe("handle");
    expect(findCloze("cat", "The category is wrong.")).toBeNull();
  });

  it("returns null when the word is not in the sentence", () => {
    expect(findCloze("reliable", "We need a better way.")).toBeNull();
    expect(findCloze("by the way", "")).toBeNull();
  });
});
