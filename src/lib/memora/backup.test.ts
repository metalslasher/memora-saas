import { describe, expect, it } from "vitest";
import { createBackupDocument, normalizeBackupDocument, parseBackupJson, previewBackup, type BackupWord } from "./backup";
import { createStoredSchedule, scheduleReview } from "./scheduler";

const reviewedAt = new Date("2026-11-18T10:00:00.000Z");
const before = createStoredSchedule(reviewedAt);
const after = scheduleReview(before, "good", reviewedAt).schedule;

const word: BackupWord = {
  lemma: "reliable",
  source: "manual",
  status: "active",
  content: { translations: ["надійний"], examples: [{ en: "A reliable way." }] },
  created_at: "2026-11-01T10:00:00.000Z",
  cards: [
    {
      ...after,
      kind: "recall",
      status: "active",
      reviews: [
        {
          rating: "good",
          reviewed_at: reviewedAt.toISOString(),
          elapsed_ms: 4200,
          response_text: "reliable",
          was_correct: true,
          schedule_before: before,
          schedule_after: after,
        },
      ],
    },
    { ...before, kind: "recognition", status: "paused", reviews: [] },
  ],
};

describe("backup", () => {
  it("round-trips a document through JSON", () => {
    const document = createBackupDocument([word], new Date("2026-11-19T00:00:00.000Z"));
    const parsed = parseBackupJson(JSON.stringify(document));
    expect(parsed).toEqual(document);
    expect(previewBackup(parsed)).toEqual({ exportedAt: "2026-11-19T00:00:00.000Z", words: 1, cards: 2, reviews: 1 });
  });

  it("rejects foreign and outdated files", () => {
    expect(() => parseBackupJson("{")).toThrow("коректним JSON");
    expect(() => normalizeBackupDocument({ product: "Other" })).toThrow("Це не резервна копія Memora.");
    expect(() =>
      normalizeBackupDocument({ product: "Memora", format: "memora-backup-v1", exportedAt: "2026-01-01", state: {} }),
    ).toThrow("формат копії застарів");
  });

  it("validates every word before anything is written", () => {
    const document = createBackupDocument([word, { ...word, lemma: "Reliable" }]);
    expect(() => normalizeBackupDocument(document)).toThrow("повторюється");
    const badCard = createBackupDocument([{ ...word, cards: [{ ...word.cards[0], kind: "qa" as never }] }]);
    expect(() => normalizeBackupDocument(badCard)).toThrow("невідомий тип");
    const noTranslation = createBackupDocument([{ ...word, content: { translations: [], examples: [] } }]);
    expect(() => normalizeBackupDocument(noTranslation)).toThrow("не має перекладу");
  });
});
