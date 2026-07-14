import { describe, expect, it } from "vitest";
import {
  findDuplicateNotes,
  normalizeLookupText,
} from "./duplicates";
import type { Note } from "./types";

function note(partial: Partial<Note> & Pick<Note, "id" | "module" | "title">): Note {
  return {
    status: "active",
    source: "user",
    tags: [partial.module],
    content: {},
    createdAt: "2026-07-12T00:00:00.000Z",
    ...partial,
  };
}

describe("duplicate detection", () => {
  it("normalizes case, punctuation, whitespace, and diacritics", () => {
    expect(normalizeLookupText("  Café-test!!  ")).toBe("cafe test");
  });

  it("finds exact English duplicates by title or lemma", () => {
    const notes = [
      note({
        id: "note-1",
        module: "english",
        title: "Flaky test",
        content: { lemma_en: "flaky test" },
      }),
      note({
        id: "note-2",
        module: "qa",
        title: "Flaky test",
        content: { term: "Flaky test" },
      }),
    ];

    const matches = findDuplicateNotes(notes, {
      module: "english",
      lemma: " flaky-test ",
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      confidence: "exact",
      matchedOn: "title",
    });
    expect(matches[0].note.id).toBe("note-1");
  });

  it("finds close QA duplicates and ignores archived notes", () => {
    const notes = [
      note({
        id: "note-1",
        module: "qa",
        title: "Regression testing",
        content: { term: "Regression testing" },
      }),
      note({
        id: "note-2",
        module: "qa",
        title: "Smoke testing",
        status: "archived",
        content: { term: "Smoke testing" },
      }),
    ];

    const closeMatches = findDuplicateNotes(notes, {
      module: "qa",
      term: "Regression",
    });
    const archivedMatches = findDuplicateNotes(notes, {
      module: "qa",
      term: "Smoke testing",
    });

    expect(closeMatches).toHaveLength(1);
    expect(closeMatches[0].confidence).toBe("close");
    expect(archivedMatches).toEqual([]);
  });
});
