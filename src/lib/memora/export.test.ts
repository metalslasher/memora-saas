import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { createBackupJson, notesToCsv } from "./export";

describe("export helpers", () => {
  it("creates a versioned JSON backup", () => {
    const state = createInitialState();
    const backup = JSON.parse(createBackupJson(state, new Date("2026-07-13T00:00:00.000Z")));

    expect(backup).toMatchObject({
      product: "Memora",
      format: "memora-backup-v1",
      exportedAt: "2026-07-13T00:00:00.000Z",
    });
    expect(backup.state.notes).toHaveLength(state.notes.length);
    expect(backup.state.imports).toEqual([]);
  });

  it("exports module notes as CSV with escaped cells", () => {
    const state = createInitialState();
    const englishCsv = notesToCsv(state.notes, "english");
    const qaCsv = notesToCsv(state.notes, "qa");

    expect(englishCsv).toContain("lemma_en,translation_uk");
    expect(englishCsv).toContain("bug");
    expect(qaCsv).toContain("term,short_definition");
    expect(qaCsv).toContain("Regression testing");
    expect(qaCsv).toContain("\"Перевірка, що");
  });
});
