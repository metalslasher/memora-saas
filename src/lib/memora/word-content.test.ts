import { describe, expect, it } from "vitest";
import {
  contentFromDraft,
  draftFromContent,
  readWordContent,
  splitTranslations,
  validateWordDraft,
  wordDraftErrors,
} from "./word-content";

describe("word content", () => {
  it("splits and de-duplicates translations", () => {
    expect(splitTranslations(" розібратися,  зрозуміти; розібратися ,")).toEqual(["розібратися", "зрозуміти"]);
  });

  it("validates drafts with Ukrainian messages", () => {
    expect(wordDraftErrors({ lemma: "", translation: "" })).toEqual([
      "Немає англійського слова або фрази.",
      "Немає українського перекладу.",
    ]);
    expect(() => validateWordDraft({ lemma: "x", translation: " , " })).toThrow("Немає українського перекладу.");
    expect(validateWordDraft({ lemma: "  figure   out ", translation: "розібратися" }).lemma).toBe("figure out");
  });

  it("builds content from a draft and round-trips it back", () => {
    const content = contentFromDraft({
      lemma: "reliable",
      translation: "надійний, певний",
      partOfSpeech: "adjective",
      example: "We need a more reliable way.",
    });
    expect(content).toEqual({
      translations: ["надійний", "певний"],
      part_of_speech: "adjective",
      examples: [{ en: "We need a more reliable way." }],
    });
    expect(draftFromContent("reliable", content)).toEqual({
      lemma: "reliable",
      translation: "надійний, певний",
      partOfSpeech: "adjective",
      example: "We need a more reliable way.",
      accepted: "",
      synonyms: "",
    });
  });

  it("edits accepted variants and synonyms only when the form has them", () => {
    const base = { translations: ["надійний"], examples: [], synonyms: ["dependable"], accepted: ["relyable"] };
    const draft = { lemma: "reliable", translation: "надійний" };
    expect(contentFromDraft(draft, base)).toMatchObject({ synonyms: ["dependable"], accepted: ["relyable"] });

    const edited = contentFromDraft({ ...draft, synonyms: "dependable, trustworthy", accepted: "" }, base);
    expect(edited.synonyms).toEqual(["dependable", "trustworthy"]);
    expect(edited).not.toHaveProperty("accepted");
  });

  it("keeps enriched fields and the example translation when editing", () => {
    const base = readWordContent({
      translations: ["дедлайн"],
      ipa: "ˈdedlaɪn",
      collocations: ["meet a deadline"],
      examples: [{ en: "The deadline got pushed.", uk: "Дедлайн перенесли." }, { en: "Second." }],
    });
    const edited = contentFromDraft(
      { lemma: "deadline", translation: "кінцевий термін", example: "The deadline got pushed." },
      base,
    );
    expect(edited.ipa).toBe("ˈdedlaɪn");
    expect(edited.collocations).toEqual(["meet a deadline"]);
    expect(edited.examples[0]).toEqual({ en: "The deadline got pushed.", uk: "Дедлайн перенесли." });

    const newExample = contentFromDraft({ lemma: "deadline", translation: "дедлайн", example: "New one." }, base);
    expect(newExample.examples).toEqual([{ en: "New one." }, { en: "Second." }]);
  });

  it("reads untrusted JSON defensively", () => {
    expect(readWordContent(null)).toEqual({ translations: [], examples: [] });
    expect(
      readWordContent({ translations: ["a", 3, ""], examples: [{ en: "" }, { en: "Hi", uk: 5 }], cloze: [{ text: "x" }] }),
    ).toEqual({ translations: ["a"], examples: [{ en: "Hi" }] });
  });
});
