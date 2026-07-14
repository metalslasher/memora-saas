import type { MemoraState, ModuleType, Note } from "./types";

export function createBackupJson(state: MemoraState, exportedAt = new Date()) {
  return JSON.stringify(
    {
      product: "Memora",
      format: "memora-backup-v1",
      exportedAt: exportedAt.toISOString(),
      state,
    },
    null,
    2,
  );
}

export function notesToCsv(notes: Note[], moduleType: ModuleType) {
  const rows =
    moduleType === "english"
      ? [
          ["lemma_en", "translation_uk", "part_of_speech", "example_en", "source", "status"],
          ...notes
            .filter((note) => note.module === "english")
            .map((note) => [
              text(note.content.lemma_en),
              text(note.content.translation_uk),
              text(note.content.part_of_speech),
              text(note.content.example_en),
              note.source,
              note.status,
            ]),
        ]
      : [
          ["term", "short_definition", "example", "source", "status"],
          ...notes
            .filter((note) => note.module === "qa")
            .map((note) => [
              text(note.content.term),
              text(note.content.short_definition),
              text(note.content.example),
              note.source,
              note.status,
            ]),
        ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function text(value: unknown) {
  if (Array.isArray(value)) return value.join("; ");
  return typeof value === "string" ? value : "";
}

function csvCell(value: string) {
  const clean = value.replace(/\r?\n/g, " ").trim();
  return /[",\n;]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}
