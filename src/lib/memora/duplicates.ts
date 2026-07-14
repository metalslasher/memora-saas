import type { ModuleType, Note } from "./types";

export type DuplicateCandidate =
  | {
      module: "english";
      lemma: string;
      translation?: string;
    }
  | {
      module: "qa";
      term: string;
      definition?: string;
    };

export type DuplicateNoteMatch = {
  note: Note;
  confidence: "exact" | "close";
  matchedOn: string;
};

export function normalizeLookupText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findDuplicateNotes(
  notes: Note[],
  candidate: DuplicateCandidate,
  limit = 3,
): DuplicateNoteMatch[] {
  const needle =
    candidate.module === "english"
      ? normalizeLookupText(candidate.lemma)
      : normalizeLookupText(candidate.term);

  if (!needle) return [];

  const matches: DuplicateNoteMatch[] = [];

  for (const note of notes) {
    if (note.module !== candidate.module || note.status === "archived") continue;

    const match = matchNote(note, candidate.module, needle);
    if (match) matches.push({ note, ...match });
  }

  return matches
    .sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === "exact" ? -1 : 1;
      return a.note.title.localeCompare(b.note.title);
    })
    .slice(0, limit);
}

function matchNote(
  note: Note,
  moduleType: ModuleType,
  needle: string,
): Omit<DuplicateNoteMatch, "note"> | null {
  const primaryFields: Array<[string, unknown]> =
    moduleType === "english"
      ? [
          ["title", note.title],
          ["English phrase", note.content.lemma_en],
        ]
      : [
          ["title", note.title],
          ["QA term", note.content.term],
        ];

  for (const [label, value] of primaryFields) {
    const normalized = normalizeFieldValue(value);
    if (!normalized) continue;

    if (normalized === needle) {
      return { confidence: "exact", matchedOn: label };
    }
  }

  for (const [label, value] of primaryFields) {
    const normalized = normalizeFieldValue(value);
    if (!normalized) continue;

    if (isCloseMatch(normalized, needle)) {
      return { confidence: "close", matchedOn: label };
    }
  }

  return null;
}

function normalizeFieldValue(value: unknown) {
  return typeof value === "string" ? normalizeLookupText(value) : "";
}

function isCloseMatch(existing: string, needle: string) {
  if (needle.length < 4 || existing.length < 4) return false;

  return existing.includes(needle) || needle.includes(existing);
}
