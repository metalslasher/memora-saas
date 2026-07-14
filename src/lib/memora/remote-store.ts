import type { SupabaseClient } from "@supabase/supabase-js";
import {
  englishContentFromDraft,
  generateEnglishCards,
  generateQaCards,
  qaContentFromDraft,
  type EnglishDraft,
  type GeneratedCardTemplate,
  type QaDraft,
} from "./card-generator";
import { createReviewSchedule, createStoredSchedule, scheduleReview } from "./scheduler";
import { starterCards, starterNotes } from "./starter-content";
import type {
  AppSettings,
  CardType,
  FsrsState,
  ImportRow,
  ImportRowStatus,
  ImportRun,
  ImportStatus,
  MemoraState,
  ModuleType,
  Note,
  ReviewLog,
  ReviewRating,
  StoredSchedule,
  StudyCard,
  StudyMode,
  UserProfile,
  UserProfileDraft,
} from "./types";

type DbDeck = {
  id: string;
  module_type: ModuleType;
  title: string;
  settings: Record<string, unknown>;
};

type DbNote = {
  id: string;
  deck_id: string;
  note_type: "english_vocab" | "qa_concept";
  source: "seed" | "user" | "imported";
  content_json: Record<string, unknown>;
  status: "active" | "suspended" | "archived";
  created_at: string;
};

type DbCard = {
  id: string;
  note_id: string;
  card_type: CardType;
  state: string;
  due_at: string;
  stability: number;
  difficulty: number;
  retrievability: number | null;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  last_reviewed_at: string | null;
  prompt_json: Record<string, unknown>;
  answer_json: Record<string, unknown>;
  status: "active" | "suspended" | "archived";
  created_at: string;
};

type DbReviewLog = {
  id: string;
  card_id: string;
  note_id: string;
  module_type: ModuleType;
  reviewed_at: string;
  rating: ReviewRating;
  elapsed_ms: number;
  response_text: string | null;
  was_correct: boolean;
  due_before: string | null;
  due_after: string | null;
};

type DbImport = {
  id: string;
  file_name: string;
  status: ImportStatus;
  row_count: number;
  created_at: string;
  updated_at: string;
};

type DbImportRow = {
  id: string;
  import_id: string;
  row_number: number;
  status: ImportRowStatus;
  error_json: Record<string, unknown>;
  raw_json: Record<string, unknown>;
  created_at: string;
};

type DbProfile = {
  id: string;
  email: string | null;
  locale: string;
  timezone: string;
  level: string | null;
  goals: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NoteContentDraft = Record<string, string | string[] | undefined>;

export type ImportCommitRow<TDraft> = {
  rowNumber: number;
  status: "invalid" | "imported" | "skipped";
  draft?: TDraft;
  errors: string[];
  raw: Record<string, string>;
};

const defaultSettings: AppSettings = {
  desiredRetention: 0.9,
  dailyNewLimit: 8,
  reviewButtons: "simple" as const,
  studyMode: "daily" as const,
};

const studyModes: StudyMode[] = ["daily", "english-productive", "qa-interview"];

const profileSelect =
  "id,email,locale,timezone,level,goals,created_at,updated_at";

const defaultProfileGoals: UserProfile["goals"] = {
  dailyMinutes: 15,
  primaryGoal: "",
};

export async function ensureRemoteProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

export async function loadRemoteProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<UserProfile> {
  await ensureRemoteProfile(supabase, userId, email);

  const { data, error } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .single();

  if (error) throw error;

  return mapProfile(data as DbProfile);
}

export async function remoteUpdateProfile(
  supabase: SupabaseClient,
  userId: string,
  draft: UserProfileDraft,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      locale: draft.locale,
      timezone: draft.timezone,
      level: draft.level || null,
      goals: {
        dailyMinutes: draft.dailyMinutes,
        primaryGoal: draft.primaryGoal,
      },
    })
    .eq("id", userId)
    .select(profileSelect)
    .single();

  if (error) throw error;

  return mapProfile(data as DbProfile);
}

export async function loadRemoteMemoraState(
  supabase: SupabaseClient,
  userId: string,
): Promise<MemoraState> {
  const { data: decks, error: decksError } = await supabase
    .from("decks")
    .select("id,module_type,title,settings")
    .order("created_at", { ascending: true });

  if (decksError) throw decksError;

  let loadedDecks = (decks ?? []) as DbDeck[];

  if (loadedDecks.length === 0) {
    await seedRemoteMemora(supabase, userId);

    const { data: seededDecks, error: seededDecksError } = await supabase
      .from("decks")
      .select("id,module_type,title,settings")
      .order("created_at", { ascending: true });

    if (seededDecksError) throw seededDecksError;
    loadedDecks = (seededDecks ?? []) as DbDeck[];
  }

  await upgradeRemoteStarterContent(supabase);

  const [notesResult, cardsResult, logsResult, importsResult] = await Promise.all([
    supabase
      .from("notes")
      .select("id,deck_id,note_type,source,content_json,status,created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("cards")
      .select(
        "id,note_id,card_type,state,due_at,stability,difficulty,retrievability,elapsed_days,scheduled_days,learning_steps,reps,lapses,last_reviewed_at,prompt_json,answer_json,status,created_at",
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("review_logs")
      .select("id,card_id,note_id,module_type,reviewed_at,rating,elapsed_ms,response_text,was_correct,due_before,due_after")
      .order("reviewed_at", { ascending: true }),
    supabase
      .from("imports")
      .select("id,file_name,status,row_count,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (notesResult.error) throw notesResult.error;
  if (cardsResult.error) throw cardsResult.error;
  if (logsResult.error) throw logsResult.error;
  if (importsResult.error) throw importsResult.error;

  const notes = ((notesResult.data ?? []) as DbNote[]).map((note) =>
    mapNote(note, loadedDecks),
  );
  const cards = ((cardsResult.data ?? []) as DbCard[]).map((card) =>
    mapCard(card, notes),
  );
  const reviewLogs = ((logsResult.data ?? []) as DbReviewLog[]).map((log) =>
    mapReviewLog(log),
  );
  const imports = await loadImportRowsForRuns(
    supabase,
    (importsResult.data ?? []) as DbImport[],
  );

  return {
    version: 1,
    settings: readSettings(loadedDecks),
    notes,
    cards,
    reviewLogs,
    imports,
  };
}

export async function remoteUpdateSettings(
  supabase: SupabaseClient,
  state: MemoraState,
  settings: AppSettings,
) {
  const { error } = await supabase
    .from("decks")
    .update({ settings })
    .in("module_type", ["english", "qa"]);

  if (error) throw error;

  return {
    ...state,
    settings,
  };
}

export async function remoteRestoreBackup(
  supabase: SupabaseClient,
  userId: string,
  backupState: MemoraState,
): Promise<MemoraState> {
  const { error: deleteError } = await supabase
    .from("decks")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) throw deleteError;

  const { data: decks, error: deckError } = await supabase
    .from("decks")
    .insert([
      {
        user_id: userId,
        module_type: "english",
        title: "English Vocabulary",
        settings: backupState.settings,
      },
      {
        user_id: userId,
        module_type: "qa",
        title: "QA Knowledge",
        settings: backupState.settings,
      },
    ])
    .select("id,module_type,title,settings");

  if (deckError) throw deckError;

  const deckByModule = new Map(
    ((decks ?? []) as DbDeck[]).map((deck) => [deck.module_type, deck.id]),
  );
  const noteIdByBackupId = new Map(
    backupState.notes.map((note) => [note.id, createUuid()]),
  );
  const cardIdByBackupId = new Map(
    backupState.cards.map((card) => [card.id, createUuid()]),
  );

  await insertRowsInChunks(
    supabase,
    "notes",
    backupState.notes.map((note) => ({
      id: noteIdByBackupId.get(note.id),
      user_id: userId,
      deck_id: deckByModule.get(note.module),
      note_type: note.module === "english" ? "english_vocab" : "qa_concept",
      source: note.source,
      content_json: note.content,
      status: note.status,
      created_at: note.createdAt,
    })),
  );

  await insertRowsInChunks(
    supabase,
    "cards",
    backupState.cards.map((card) =>
      restoredCardInsert(
        userId,
        cardIdByBackupId.get(card.id)!,
        noteIdByBackupId.get(card.noteId)!,
        card,
      ),
    ),
  );

  await insertRowsInChunks(
    supabase,
    "review_logs",
    backupState.reviewLogs.map((log) => ({
      id: createUuid(),
      user_id: userId,
      card_id: cardIdByBackupId.get(log.cardId),
      note_id: noteIdByBackupId.get(log.noteId),
      module_type: log.module,
      reviewed_at: log.reviewedAt,
      rating: log.rating,
      elapsed_ms: log.elapsedMs,
      response_text: log.responseText || null,
      was_correct: log.wasCorrect,
      due_before: log.dueBefore || null,
      due_after: log.dueAfter || null,
      schedule_before: log.dueBefore ? { due: log.dueBefore } : {},
      schedule_after: log.dueAfter ? { due: log.dueAfter } : {},
    })),
  );

  return loadRemoteMemoraState(supabase, userId);
}

export async function remoteReviewCard(
  supabase: SupabaseClient,
  state: MemoraState,
  cardId: string,
  rating: ReviewRating,
  responseText: string,
  elapsedMs: number,
) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return state;

  const reviewedAt = new Date();
  const outcome = scheduleReview(card.schedule, rating, reviewedAt);
  const cardPatch = scheduleToCardPatch(outcome.schedule, reviewedAt);

  const { error: cardError } = await supabase
    .from("cards")
    .update(cardPatch)
    .eq("id", cardId);

  if (cardError) throw cardError;

  const { data: insertedLog, error: logError } = await supabase
    .from("review_logs")
    .insert({
      card_id: card.id,
      note_id: card.noteId,
      module_type: card.module,
      rating,
      elapsed_ms: elapsedMs,
      response_text: responseText,
      was_correct: rating !== "again",
      due_before: card.schedule.due,
      due_after: outcome.schedule.due,
      schedule_before: card.schedule,
      schedule_after: outcome.schedule,
      reviewed_at: reviewedAt.toISOString(),
    })
    .select("id,card_id,note_id,module_type,reviewed_at,rating,elapsed_ms,response_text,was_correct,due_before,due_after")
    .single();

  if (logError) throw logError;

  return {
    ...state,
    cards: state.cards.map((item) =>
      item.id === cardId ? { ...item, schedule: outcome.schedule } : item,
    ),
    reviewLogs: [
      ...state.reviewLogs,
      mapReviewLog(insertedLog as DbReviewLog),
    ],
  };
}

export async function remoteAddEnglishNote(
  supabase: SupabaseClient,
  draft: EnglishDraft,
) {
  const deckId = await getOrCreateDeck(supabase, "english");
  await insertEnglishNoteWithCards(supabase, deckId, draft, "user");

  return loadRemoteMemoraState(supabase, await getAuthenticatedUserId(supabase));
}

export async function remoteAddQaNote(
  supabase: SupabaseClient,
  draft: QaDraft,
) {
  const deckId = await getOrCreateDeck(supabase, "qa");
  await insertQaNoteWithCards(supabase, deckId, draft, "user");

  return loadRemoteMemoraState(supabase, await getAuthenticatedUserId(supabase));
}

export async function remoteImportEnglishNotes(
  supabase: SupabaseClient,
  fileName: string,
  rows: ImportCommitRow<EnglishDraft>[],
) {
  const deckId = await getOrCreateDeck(supabase, "english");
  await importRowsWithHistory(
    supabase,
    fileName,
    "english",
    rows,
    async (draft) => insertEnglishNoteWithCards(supabase, deckId, draft, "imported"),
  );

  return loadRemoteMemoraState(supabase, await getAuthenticatedUserId(supabase));
}

export async function remoteImportQaNotes(
  supabase: SupabaseClient,
  fileName: string,
  rows: ImportCommitRow<QaDraft>[],
) {
  const deckId = await getOrCreateDeck(supabase, "qa");
  await importRowsWithHistory(
    supabase,
    fileName,
    "qa",
    rows,
    async (draft) => insertQaNoteWithCards(supabase, deckId, draft, "imported"),
  );

  return loadRemoteMemoraState(supabase, await getAuthenticatedUserId(supabase));
}

export async function remoteSuspendCard(
  supabase: SupabaseClient,
  state: MemoraState,
  cardId: string,
) {
  const { error } = await supabase
    .from("cards")
    .update({ status: "suspended", state: "suspended" })
    .eq("id", cardId);

  if (error) throw error;

  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === cardId ? { ...card, status: "suspended" as const } : card,
    ),
  };
}

export async function remoteUpdateCardStatus(
  supabase: SupabaseClient,
  state: MemoraState,
  cardId: string,
  status: "active" | "suspended" | "archived",
): Promise<MemoraState> {
  const currentCard = state.cards.find((card) => card.id === cardId);
  const dbPatch =
    status === "active"
      ? {
          status,
          state: currentCard?.schedule.state.toLowerCase() ?? "review",
        }
      : { status, state: status };
  const { error } = await supabase
    .from("cards")
    .update(dbPatch)
    .eq("id", cardId);

  if (error) throw error;

  return {
    ...state,
    cards: state.cards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            status,
            schedule:
              status === "active"
                ? card.schedule
                : { ...card.schedule, state: "Review" as const },
          }
        : card,
    ),
  };
}

export async function remoteUpdateNoteContent(
  supabase: SupabaseClient,
  state: MemoraState,
  noteId: string,
  content: NoteContentDraft,
): Promise<MemoraState> {
  const currentNote = state.notes.find((note) => note.id === noteId);
  if (!currentNote) return state;

  const normalizedContent = normalizeNoteContent(currentNote.module, content);

  const { data: updatedNote, error: noteError } = await supabase
    .from("notes")
    .update({ content_json: normalizedContent })
    .eq("id", noteId)
    .select("id,deck_id,note_type,source,content_json,status,created_at")
    .single();

  if (noteError) throw noteError;

  const nextCards = [...state.cards];
  const cardsForNote = nextCards.filter((card) => card.noteId === noteId);

  for (const card of cardsForNote) {
    const patch = cardContentPatch(card, normalizedContent);
    if (!patch) continue;

    const { error: cardError } = await supabase
      .from("cards")
      .update(patch)
      .eq("id", card.id);

    if (cardError) throw cardError;

    const cardIndex = nextCards.findIndex((item) => item.id === card.id);
    if (cardIndex >= 0) {
      nextCards[cardIndex] = {
        ...nextCards[cardIndex],
        ...patchToStudyCardFields(patch),
      };
    }
  }

  const nextNote = mapNote(updatedNote as DbNote, [
    {
      id: (updatedNote as DbNote).deck_id,
      module_type: currentNote.module,
      title: "",
      settings: {},
    },
  ]);

  return {
    ...state,
    notes: state.notes.map((note) => (note.id === noteId ? nextNote : note)),
    cards: nextCards,
  };
}

export async function remoteUpdateNoteStatus(
  supabase: SupabaseClient,
  state: MemoraState,
  noteId: string,
  status: "active" | "suspended" | "archived",
): Promise<MemoraState> {
  const { data: updatedNote, error: noteError } = await supabase
    .from("notes")
    .update({ status })
    .eq("id", noteId)
    .select("id,deck_id,note_type,source,content_json,status,created_at")
    .single();

  if (noteError) throw noteError;

  const cardStatus: "active" | "suspended" | "archived" =
    status === "active" ? "active" : status;
  const cardPatch =
    status === "active" ? { status: cardStatus } : { status: cardStatus, state: status };
  const { error: cardsError } = await supabase
    .from("cards")
    .update(cardPatch)
    .eq("note_id", noteId);

  if (cardsError) throw cardsError;

  const currentNote = state.notes.find((note) => note.id === noteId);
  const moduleType =
    currentNote?.module ??
    ((updatedNote as DbNote).note_type === "english_vocab" ? "english" : "qa");
  const nextNote = mapNote(updatedNote as DbNote, [
    {
      id: (updatedNote as DbNote).deck_id,
      module_type: moduleType,
      title: "",
      settings: {},
    },
  ]);

  return {
    ...state,
    notes: state.notes.map((note) => (note.id === noteId ? nextNote : note)),
    cards: state.cards.map((card) =>
      card.noteId === noteId
        ? {
            ...card,
            status: cardStatus,
            schedule:
              cardStatus === "active"
                ? card.schedule
                : { ...card.schedule, state: "Review" as const },
          }
        : card,
    ),
  };
}

async function seedRemoteMemora(supabase: SupabaseClient, userId: string) {
  const { count: existingCards, error: existingCardsError } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true });

  if (existingCardsError) throw existingCardsError;

  if ((existingCards ?? 0) > 0) {
    return;
  }

  const englishDeckId = await getOrCreateDeck(supabase, "english", userId);
  const qaDeckId = await getOrCreateDeck(supabase, "qa", userId);
  const deckByModule: Record<ModuleType, string> = {
    english: englishDeckId,
    qa: qaDeckId,
  };

  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .insert(
      starterNotes.map((starterNote) => ({
        deck_id: deckByModule[starterNote.module],
        note_type:
          starterNote.module === "english" ? "english_vocab" : "qa_concept",
        source: "seed",
        content_json: starterNote.content,
      })),
    )
    .select("id");

  if (notesError) throw notesError;

  const noteIdByKey = new Map(
    starterNotes.map((starterNote, index) => [
      starterNote.key,
      (notes ?? [])[index]?.id,
    ]),
  );

  await insertCards(
    supabase,
    starterCards.map((starterCard) =>
      buildCardInsert(noteIdByKey.get(starterCard.noteKey)!, {
        ...starterCard,
        schedule: starterCard.scheduledDays
          ? createReviewSchedule(new Date(), starterCard.scheduledDays)
          : createStoredSchedule(),
      }),
    ),
  );
}

async function upgradeRemoteStarterContent(supabase: SupabaseClient) {
  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .select("id,deck_id,note_type,source,content_json,status,created_at")
    .eq("source", "seed");

  if (notesError) throw notesError;
  if (!notes?.length) return;

  const noteByKey = new Map<string, DbNote>();

  for (const starterNote of starterNotes) {
    const existingNote = (notes as DbNote[]).find((note) =>
      starterNote.module === "english"
        ? String(note.content_json.lemma_en ?? "") ===
          String(starterNote.content.lemma_en ?? "")
        : String(note.content_json.term ?? "") ===
          String(starterNote.content.term ?? ""),
    );

    if (!existingNote) continue;
    noteByKey.set(starterNote.key, existingNote);

    if (!sameJson(existingNote.content_json, starterNote.content)) {
      const { error } = await supabase
        .from("notes")
        .update({ content_json: starterNote.content })
        .eq("id", existingNote.id);

      if (error) throw error;
    }
  }

  const noteIds = Array.from(noteByKey.values()).map((note) => note.id);
  if (noteIds.length === 0) return;

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id,note_id,card_type,prompt_json,answer_json")
    .in("note_id", noteIds);

  if (cardsError) throw cardsError;

  for (const starterCard of starterCards) {
    const note = noteByKey.get(starterCard.noteKey);
    if (!note) continue;

    const existingCard = (cards ?? []).find(
      (card) =>
        card.note_id === note.id && card.card_type === starterCard.type,
    );
    if (!existingCard) continue;

    const patch = cardTemplateContentPatch(starterCard);
    if (
      sameJson(existingCard.prompt_json, patch.prompt_json) &&
      sameJson(existingCard.answer_json, patch.answer_json)
    ) {
      continue;
    }

    const { error } = await supabase
      .from("cards")
      .update(patch)
      .eq("id", existingCard.id);

    if (error) throw error;
  }
}

async function getOrCreateDeck(
  supabase: SupabaseClient,
  moduleType: ModuleType,
  authenticatedUserId?: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("decks")
    .select("id")
    .eq("module_type", moduleType)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const userId = authenticatedUserId ?? (await getAuthenticatedUserId(supabase));

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      user_id: userId,
      module_type: moduleType,
      title: moduleType === "english" ? "English Vocabulary" : "QA Knowledge",
      settings: defaultSettings,
    })
    .select("id")
    .maybeSingle();

  if (!deckError && deck?.id) return deck.id as string;
  if (deckError && !isUniqueViolation(deckError)) throw deckError;

  const { data: existingAfterRace, error: raceError } = await supabase
    .from("decks")
    .select("id")
    .eq("module_type", moduleType)
    .single();

  if (raceError) throw raceError;
  return existingAfterRace.id as string;
}

async function insertCards(
  supabase: SupabaseClient,
  cards: Array<Record<string, unknown>>,
) {
  const { error } = await supabase.from("cards").insert(cards);
  if (error) throw error;
}

async function insertRowsInChunks(
  supabase: SupabaseClient,
  table: string,
  rows: Array<Record<string, unknown>>,
  chunkSize = 500,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;

    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function insertEnglishNoteWithCards(
  supabase: SupabaseClient,
  deckId: string,
  draft: EnglishDraft,
  source: DbNote["source"],
) {
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .insert({
      deck_id: deckId,
      note_type: "english_vocab",
      source,
      content_json: englishContentFromDraft(draft),
    })
    .select("id")
    .single();

  if (noteError) throw noteError;

  await insertCards(
    supabase,
    generateEnglishCards(draft).map((card) =>
      buildCardInsert(note.id as string, {
        ...card,
        schedule: createStoredSchedule(),
      }),
    ),
  );
}

async function insertQaNoteWithCards(
  supabase: SupabaseClient,
  deckId: string,
  draft: QaDraft,
  source: DbNote["source"],
) {
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .insert({
      deck_id: deckId,
      note_type: "qa_concept",
      source,
      content_json: qaContentFromDraft(draft),
    })
    .select("id")
    .single();

  if (noteError) throw noteError;

  await insertCards(
    supabase,
    generateQaCards(draft).map((card) =>
      buildCardInsert(note.id as string, {
        ...card,
        schedule: createStoredSchedule(),
      }),
    ),
  );
}

async function importRowsWithHistory<TDraft>(
  supabase: SupabaseClient,
  fileName: string,
  moduleType: ModuleType,
  rows: ImportCommitRow<TDraft>[],
  insertImportedDraft: (draft: TDraft) => Promise<void>,
) {
  const { data: importRun, error: importError } = await supabase
    .from("imports")
    .insert({
      file_name: fileName,
      status: "processing",
      row_count: rows.length,
    })
    .select("id")
    .single();

  if (importError) throw importError;

  const importId = importRun.id as string;

  try {
    for (const row of rows) {
      if (row.status === "imported" && row.draft) {
        await insertImportedDraft(row.draft);
      }
    }

    const { error: rowError } = await supabase
      .from("import_rows")
      .insert(rows.map((row) => buildImportRowInsert(importId, moduleType, row)));

    if (rowError) throw rowError;

    const { error: completeError } = await supabase
      .from("imports")
      .update({ status: "completed" })
      .eq("id", importId);

    if (completeError) throw completeError;
  } catch (error) {
    await supabase
      .from("imports")
      .update({ status: "failed" })
      .eq("id", importId);
    throw error;
  }
}

function buildImportRowInsert<TDraft>(
  importId: string,
  moduleType: ModuleType,
  row: ImportCommitRow<TDraft>,
) {
  return {
    import_id: importId,
    row_number: row.rowNumber,
    status: row.status,
    error_json: { errors: row.errors },
    raw_json: {
      module: moduleType,
      draft: row.draft ?? null,
      raw: row.raw,
    },
  };
}

function buildCardInsert(
  noteId: string,
  card: GeneratedCardTemplate & { schedule: StoredSchedule },
) {
  return {
    note_id: noteId,
    card_type: card.type,
    ...cardTemplateContentPatch(card),
    ...scheduleToCardPatch(card.schedule),
  };
}

function restoredCardInsert(
  userId: string,
  cardId: string,
  noteId: string,
  card: StudyCard,
) {
  const schedulePatch = scheduleToCardPatch(card.schedule);

  return {
    id: cardId,
    user_id: userId,
    note_id: noteId,
    card_type: card.type,
    status: card.status,
    ...schedulePatch,
    state:
      card.status === "active"
        ? schedulePatch.state
        : card.status,
    prompt_json: {
      text: card.prompt,
      module: card.module,
      priority: card.priority,
      tags: card.tags,
    },
    answer_json: {
      text: card.answer,
      explanation: card.explanation,
      example: card.example,
    },
  };
}

function cardTemplateContentPatch(card: GeneratedCardTemplate) {
  return {
    prompt_json: {
      text: card.prompt,
      module: card.module,
      priority: card.priority,
      tags: card.tags,
    },
    answer_json: {
      text: card.answer,
      explanation: card.explanation,
      example: card.example,
    },
  };
}

function normalizeNoteContent(moduleType: ModuleType, content: NoteContentDraft) {
  if (moduleType === "english") {
    return {
      lemma_en: cleanText(content.lemma_en),
      translation_uk: cleanText(content.translation_uk),
      part_of_speech: cleanText(content.part_of_speech) || "phrase",
      example_en: cleanText(content.example_en),
    };
  }

  return {
    term: cleanText(content.term),
    short_definition: cleanText(content.short_definition),
    example: cleanText(content.example),
  };
}

function cardContentPatch(
  card: StudyCard,
  content: NoteContentDraft,
): { prompt_json: Record<string, unknown>; answer_json: Record<string, unknown> } | null {
  const basePrompt = {
    module: card.module,
    priority: card.priority,
    tags: card.tags,
  };

  if (card.module === "english") {
    const lemma = cleanText(content.lemma_en);
    const translation = cleanText(content.translation_uk);
    const example = cleanText(content.example_en);

    if (!lemma || !translation) return null;

    if (card.type === "productive_translation") {
      return {
        prompt_json: {
          ...basePrompt,
          text: `Як сказати англійською: ${translation}?`,
        },
        answer_json: {
          text: lemma,
          explanation: card.explanation,
          example,
        },
      };
    }

    if (card.type === "receptive_translation") {
      return {
        prompt_json: {
          ...basePrompt,
          text: `Що українською означає "${lemma}"?`,
        },
        answer_json: {
          text: translation,
          explanation: card.explanation,
          example,
        },
      };
    }

    if (card.type === "cloze_context" && example) {
      return {
        prompt_json: {
          ...basePrompt,
          text: example.replace(new RegExp(escapeRegExp(lemma), "i"), "___"),
        },
        answer_json: {
          text: lemma,
          explanation: card.explanation,
          example,
        },
      };
    }
  }

  const term = cleanText(content.term);
  const definition = cleanText(content.short_definition);
  const example = cleanText(content.example);

  if (!term || !definition) return null;

  if (card.type === "term_definition") {
    return {
      prompt_json: {
        ...basePrompt,
        text: `Поясни українською: що таке ${term}?`,
      },
      answer_json: {
        text: definition,
        explanation: card.explanation,
        example,
      },
    };
  }

  if (card.type === "definition_term") {
    return {
      prompt_json: {
        ...basePrompt,
        text: `Який QA термін відповідає цьому поясненню: ${definition}`,
      },
      answer_json: {
        text: term,
        explanation: card.explanation,
        example,
      },
    };
  }

  return {
    prompt_json: {
      ...basePrompt,
      text: card.prompt,
    },
    answer_json: {
      text: card.answer,
      explanation: card.explanation,
      example,
    },
  };
}

function patchToStudyCardFields(patch: {
  prompt_json: Record<string, unknown>;
  answer_json: Record<string, unknown>;
}) {
  return {
    prompt: String(patch.prompt_json.text ?? ""),
    answer: String(patch.answer_json.text ?? ""),
    explanation: String(patch.answer_json.explanation ?? ""),
    example: patch.answer_json.example
      ? String(patch.answer_json.example)
      : undefined,
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createUuid() {
  return crypto.randomUUID();
}

function mapNote(note: DbNote, decks: DbDeck[]): Note {
  const deck = decks.find((item) => item.id === note.deck_id);
  const moduleType =
    deck?.module_type ?? (note.note_type === "english_vocab" ? "english" : "qa");
  const title =
    String(note.content_json.lemma_en ?? note.content_json.term ?? "Матеріал без назви");

  return {
    id: note.id,
    module: moduleType,
    title,
    status: note.status,
    source: note.source,
    tags: [moduleType, note.source],
    content: note.content_json as Note["content"],
    createdAt: note.created_at,
  };
}

function mapCard(card: DbCard, notes: Note[]): StudyCard {
  const note = notes.find((item) => item.id === card.note_id);
  const promptTags = Array.isArray(card.prompt_json.tags)
    ? card.prompt_json.tags.map(String)
    : [note?.module ?? "english"];

  return {
    id: card.id,
    noteId: card.note_id,
    module: note?.module ?? (card.prompt_json.module as ModuleType) ?? "english",
    type: card.card_type,
    priority: Number(card.prompt_json.priority ?? 50),
    prompt: String(card.prompt_json.text ?? ""),
    answer: String(card.answer_json.text ?? ""),
    explanation: String(card.answer_json.explanation ?? ""),
    example: card.answer_json.example ? String(card.answer_json.example) : undefined,
    tags: promptTags,
    schedule: cardToSchedule(card),
    status: card.status,
  };
}

function mapReviewLog(log: DbReviewLog): ReviewLog {
  return {
    id: log.id,
    cardId: log.card_id,
    noteId: log.note_id,
    module: log.module_type,
    rating: log.rating,
    responseText: log.response_text ?? "",
    elapsedMs: log.elapsed_ms,
    reviewedAt: log.reviewed_at,
    dueBefore: log.due_before ?? "",
    dueAfter: log.due_after ?? "",
    wasCorrect: log.was_correct,
  };
}

async function loadImportRowsForRuns(
  supabase: SupabaseClient,
  imports: DbImport[],
): Promise<ImportRun[]> {
  if (imports.length === 0) return [];

  const importIds = imports.map((item) => item.id);
  const { data: rows, error } = await supabase
    .from("import_rows")
    .select("id,import_id,row_number,status,error_json,raw_json,created_at")
    .in("import_id", importIds)
    .order("row_number", { ascending: true });

  if (error) throw error;

  const rowsByImport = new Map<string, ImportRow[]>();
  for (const row of (rows ?? []) as DbImportRow[]) {
    const mapped = mapImportRow(row);
    rowsByImport.set(row.import_id, [
      ...(rowsByImport.get(row.import_id) ?? []),
      mapped,
    ]);
  }

  return imports.map((item) => ({
    id: item.id,
    fileName: item.file_name,
    status: item.status,
    rowCount: item.row_count,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    rows: rowsByImport.get(item.id) ?? [],
  }));
}

function mapImportRow(row: DbImportRow): ImportRow {
  const errors = Array.isArray(row.error_json.errors)
    ? row.error_json.errors.map(String)
    : [];
  const moduleValue = row.raw_json.module;
  const moduleType =
    moduleValue === "english" || moduleValue === "qa" ? moduleValue : undefined;

  return {
    id: row.id,
    importId: row.import_id,
    rowNumber: row.row_number,
    status: row.status,
    errors,
    raw: row.raw_json,
    module: moduleType,
    createdAt: row.created_at,
  };
}

function mapProfile(profile: DbProfile): UserProfile {
  return {
    id: profile.id,
    email: profile.email,
    locale: profile.locale || "uk-UA",
    timezone: profile.timezone || "Europe/Kiev",
    level: profile.level ?? "",
    goals: readProfileGoals(profile.goals),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function readProfileGoals(raw: unknown): UserProfile["goals"] {
  if (!raw || typeof raw !== "object") return defaultProfileGoals;

  const goals = raw as Record<string, unknown>;
  const dailyMinutes = Number(goals.dailyMinutes);
  const primaryGoal =
    typeof goals.primaryGoal === "string" ? goals.primaryGoal.trim() : "";

  return {
    dailyMinutes:
      Number.isFinite(dailyMinutes) && dailyMinutes >= 5 && dailyMinutes <= 180
        ? Math.round(dailyMinutes)
        : defaultProfileGoals.dailyMinutes,
    primaryGoal: primaryGoal.slice(0, 500),
  };
}

async function getAuthenticatedUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Потрібно увійти в Memora.");

  return data.user.id;
}

function readSettings(decks: DbDeck[]): AppSettings {
  const raw = decks.find((deck) => deck.settings)?.settings ?? {};
  const desiredRetention = Number(raw.desiredRetention);
  const dailyNewLimit = Number(raw.dailyNewLimit);
  const studyMode = String(raw.studyMode);

  return {
    desiredRetention:
      desiredRetention > 0 && desiredRetention <= 1
        ? desiredRetention
        : defaultSettings.desiredRetention,
    dailyNewLimit:
      Number.isFinite(dailyNewLimit) && dailyNewLimit >= 0
        ? dailyNewLimit
        : defaultSettings.dailyNewLimit,
    reviewButtons: raw.reviewButtons === "advanced" ? "advanced" : "simple",
    studyMode: studyModes.includes(studyMode as StudyMode)
      ? (studyMode as StudyMode)
      : defaultSettings.studyMode,
  };
}

function cardToSchedule(card: DbCard): StoredSchedule {
  return {
    due: card.due_at,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: toFsrsState(card.state),
    last_review: card.last_reviewed_at,
  };
}

function scheduleToCardPatch(schedule: StoredSchedule, reviewedAt?: Date) {
  return {
    state: schedule.state.toLowerCase(),
    due_at: schedule.due,
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: schedule.elapsed_days,
    scheduled_days: schedule.scheduled_days,
    learning_steps: schedule.learning_steps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    last_reviewed_at: reviewedAt?.toISOString() ?? schedule.last_review ?? null,
  };
}

function toFsrsState(state: string): FsrsState {
  const map: Record<string, FsrsState> = {
    new: "New",
    learning: "Learning",
    review: "Review",
    relearning: "Relearning",
    suspended: "Review",
    leech: "Review",
    archived: "Review",
  };

  return map[state] ?? "New";
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
