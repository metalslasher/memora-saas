import { describe, expect, it } from "vitest";
import {
  normalizeBackupDocument,
  parseBackupJson,
  previewBackup,
} from "./backup";
import { createBackupJson } from "./export";
import { createInitialState } from "./seed";

describe("backup helpers", () => {
  it("parses and previews a Memora backup", () => {
    const state = createInitialState();
    const backup = parseBackupJson(
      createBackupJson(state, new Date("2026-07-13T00:00:00.000Z")),
    );

    expect(backup.format).toBe("memora-backup-v1");
    expect(backup.state.notes).toHaveLength(state.notes.length);
    expect(previewBackup(backup)).toMatchObject({
      exportedAt: "2026-07-13T00:00:00.000Z",
      notes: state.notes.length,
      cards: state.cards.length,
    });
  });

  it("rejects files that are not Memora backups", () => {
    expect(() => normalizeBackupDocument({ product: "Other" })).toThrow(
      "Це не резервна копія Memora",
    );
  });

  it("rejects cards with missing note references", () => {
    const state = createInitialState();
    const payload = JSON.parse(createBackupJson(state));
    payload.state.cards[0].noteId = "missing-note";

    expect(() => normalizeBackupDocument(payload)).toThrow(
      "неіснуючий матеріал",
    );
  });
});
