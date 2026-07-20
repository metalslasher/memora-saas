"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  Check,
  Code2,
  FileText,
  Languages,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  englishContentFromDraft,
  generateEnglishCards,
  generateQaCards,
  normalizeEnglishDraft,
  normalizeQaDraft,
  qaContentFromDraft,
  type EnglishDraft,
  type QaDraft,
} from "@/lib/memora/card-generator";
import { csvTemplate, parseCsvImport, type CsvImportPreview } from "@/lib/memora/csv-import";
import { findDuplicateNotes } from "@/lib/memora/duplicates";
import type { NoteContentDraft } from "@/lib/memora/remote-store";
import type { ImportRun, ModuleType, Note, StudyCard } from "@/lib/memora/types";
import { BrandLockup } from "./layout";
import { Badge, EmptyState, MiniStat, ShellPanel, TextArea, TextInput } from "./shared-ui";
import type { ClientImportCommitRow, ImportResultSummary, ItemStatus } from "./types";
import {
  formatDate,
  importRunStats,
  labelCardType,
  labelImportRowStatus,
  labelImportStatus,
  labelSource,
  labelStatus,
  normalizeSentence,
  noteMatchesQuery,
  statusRank,
  textValue,
} from "./utils";

export function ContentManager({
  cards,
  imports,
  isBusy,
  moduleType,
  notes,
  selectedNote,
  onAddEnglish,
  onAddQa,
  onImport,
  onNoteContentChange,
  onNoteDelete,
  onNoteSelect,
  onNoteStatusChange,
}: {
  cards: StudyCard[];
  imports: ImportRun[];
  isBusy: boolean;
  moduleType: ModuleType;
  notes: Note[];
  selectedNote: Note | null;
  onAddEnglish: (draft: EnglishDraft) => Promise<void>;
  onAddQa: (draft: QaDraft) => Promise<void>;
  onImport: (
    rows: ClientImportCommitRow[],
    skipDuplicates: boolean,
    fileName: string | null,
  ) => Promise<ImportResultSummary>;
  onNoteContentChange: (
    noteId: string,
    content: NoteContentDraft,
  ) => Promise<void>;
  onNoteDelete: (noteId: string) => Promise<void>;
  onNoteSelect: (noteId: string | null) => void;
  onNoteStatusChange: (noteId: string, status: ItemStatus) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNotes = normalizedQuery
    ? notes.filter((note) => noteMatchesQuery(note, normalizedQuery))
    : notes;
  const selectedCards = selectedNote
    ? cards
        .filter((card) => card.noteId === selectedNote.id)
        .sort((a, b) => statusRank(a.status) - statusRank(b.status))
    : [];
  const activeCards = cards.filter(
    (card) => card.module === moduleType && card.status === "active",
  );
  const suspendedCards = cards.filter(
    (card) => card.module === moduleType && card.status === "suspended",
  );

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.95fr)_minmax(360px,1.05fr)]">
        <NewMaterialPanel
          isBusy={isBusy}
          moduleType={moduleType}
          notes={notes}
          onAddEnglish={onAddEnglish}
          onAddQa={onAddQa}
          onMergeDuplicate={onNoteContentChange}
          onNoteSelect={onNoteSelect}
        />

        <CsvImportPanel
          isBusy={isBusy}
          importRuns={imports}
          moduleType={moduleType}
          notes={notes}
          onImport={onImport}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_120px_120px_120px]">
        <label className="flex min-h-18 items-center gap-2 rounded-lg border border-[#263140] bg-[#10161f] px-4 text-sm text-[#c7d0dd]">
          <Search className="size-4 text-[#6f7d90]" />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#6f7d90]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук"
          />
        </label>
        <MiniStat label="Активні" value={activeCards.length.toString()} />
        <MiniStat label="Пауза" value={suspendedCards.length.toString()} />
        <MiniStat label="Усього" value={notes.length.toString()} />
      </div>

      {filteredNotes.length === 0 ? (
        <ShellPanel className="p-6">
          <EmptyState
            icon={FileText}
            title={notes.length === 0 ? "Матеріалів ще немає" : "Нічого не знайдено"}
            description={
              notes.length === 0
                ? "Додай перший матеріал вручну або через CSV."
                : "Зміни пошук або очисти поле."
            }
          />
        </ShellPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {filteredNotes.map((note) => {
            const noteCards = cards.filter((card) => card.noteId === note.id);
            const activeNoteCards = noteCards.filter(
              (card) => card.status === "active",
            );

            return (
              <NoteTile
                key={note.id}
                activeCardCount={activeNoteCards.length}
                cardCount={noteCards.length}
                isSelected={note.id === selectedNote?.id}
                note={note}
                onClick={() => onNoteSelect(note.id)}
              />
            );
          })}
        </div>
      )}

      {selectedNote ? (
        <NoteDetailModal onClose={() => onNoteSelect(null)}>
          <NoteDetailPanel
            cards={selectedCards}
            isBusy={isBusy}
            moduleType={moduleType}
            note={selectedNote}
            onNoteContentChange={onNoteContentChange}
            onNoteDelete={onNoteDelete}
            onClose={() => onNoteSelect(null)}
            onNoteStatusChange={onNoteStatusChange}
          />
        </NoteDetailModal>
      ) : null}
    </div>
  );
}

function NoteTile({
  activeCardCount,
  cardCount,
  isSelected,
  note,
  onClick,
}: {
  activeCardCount: number;
  cardCount: number;
  isSelected: boolean;
  note: Note;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg border p-4 text-left transition ${
        isSelected
          ? "border-[#2dd4bf] bg-[#14352f]"
          : "border-[#263140] bg-[#10161f] hover:border-[#344052] hover:bg-[#151d28]"
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[#eef4ff]">
            {note.title}
          </p>
          <p className="mt-1 text-xs text-[#9aa8ba]">
            {labelSource(note.source)}
          </p>
        </div>
        <span className="font-mono text-sm text-[#c7d0dd]">{cardCount}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={note.status === "active" ? "green" : "neutral"}>
          {labelStatus(note.status)}
        </Badge>
        <Badge tone="neutral">активних карток: {activeCardCount}</Badge>
      </div>
    </button>
  );
}

function NoteDetailModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      aria-modal="true"
      aria-label="Деталі матеріалу"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#02050a]/78 p-0 backdrop-blur-md sm:p-4 lg:p-6"
      role="dialog"
    >
      <button
        aria-label="Закрити"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative flex w-full max-w-6xl flex-col overflow-hidden bg-[#10161f] sm:rounded-lg sm:border sm:border-[#263140] sm:shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#263140] bg-[#10161f] px-3 py-3 sm:px-4">
          <BrandLockup />
          <button
            aria-label="Закрити"
            className="grid size-10 place-items-center rounded-lg border border-[#263140] text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function NewMaterialPanel({
  isBusy,
  moduleType,
  notes,
  onAddEnglish,
  onAddQa,
  onMergeDuplicate,
  onNoteSelect,
}: {
  isBusy: boolean;
  moduleType: ModuleType;
  notes: Note[];
  onAddEnglish: (draft: EnglishDraft) => Promise<void>;
  onAddQa: (draft: QaDraft) => Promise<void>;
  onMergeDuplicate: (
    noteId: string,
    content: NoteContentDraft,
  ) => Promise<void>;
  onNoteSelect: (noteId: string | null) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [english, setEnglish] = useState<EnglishDraft>({
    lemma: "",
    translation: "",
    example: "",
  });
  const [qa, setQa] = useState<QaDraft>({
    term: "",
    definition: "",
    example: "",
  });
  const normalizedEnglish = useMemo(
    () => normalizeEnglishDraft(english),
    [english],
  );
  const normalizedQa = useMemo(() => normalizeQaDraft(qa), [qa]);
  const isEnglish = moduleType === "english";
  const canSubmit = isEnglish
    ? Boolean(normalizedEnglish.lemma && normalizedEnglish.translation)
    : Boolean(normalizedQa.term && normalizedQa.definition);
  const previewCards = useMemo(
    () =>
      isEnglish
        ? generateEnglishCards(normalizedEnglish)
        : generateQaCards(normalizedQa),
    [isEnglish, normalizedEnglish, normalizedQa],
  );
  const duplicateMatches = useMemo(
    () =>
      isEnglish
        ? findDuplicateNotes(notes, {
            module: "english",
            lemma: normalizedEnglish.lemma,
          })
        : findDuplicateNotes(notes, {
            module: "qa",
            term: normalizedQa.term,
          }),
    [isEnglish, normalizedEnglish.lemma, normalizedQa.term, notes],
  );
  const blockingDuplicate = duplicateMatches.length > 0 && !allowDuplicate;
  const submitDisabled = !canSubmit || blockingDuplicate || isBusy || isSubmitting;
  const primaryDuplicate = duplicateMatches.at(0)?.note ?? null;

  function resetLocalState() {
    setAllowDuplicate(false);
    setLocalMessage(null);
  }

  async function submit() {
    if (submitDisabled) return;

    setIsSubmitting(true);
    setLocalMessage(null);

    try {
      if (isEnglish) {
        await onAddEnglish(normalizedEnglish);
        setEnglish({ lemma: "", translation: "", example: "" });
        setLocalMessage("Матеріал додано.");
      } else {
        await onAddQa(normalizedQa);
        setQa({ term: "", definition: "", example: "" });
        setLocalMessage("Матеріал додано.");
      }
      setAllowDuplicate(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mergeDuplicate() {
    if (!primaryDuplicate || !canSubmit || isBusy || isSubmitting) return;

    setIsSubmitting(true);
    setLocalMessage(null);

    try {
      await onMergeDuplicate(
        primaryDuplicate.id,
        isEnglish
          ? englishContentFromDraft(normalizedEnglish)
          : qaContentFromDraft(normalizedQa),
      );
      onNoteSelect(primaryDuplicate.id);
      if (isEnglish) {
        setEnglish({ lemma: "", translation: "", example: "" });
      } else {
        setQa({ term: "", definition: "", example: "" });
      }
      setAllowDuplicate(false);
      setLocalMessage("Існуючий матеріал оновлено.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Новий матеріал"
      className="rounded-lg border border-[#263140] bg-[#0d131c] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#eef4ff]">Новий матеріал</h3>
        {isEnglish ? (
          <Languages className="size-4 text-[#52e0c4]" />
        ) : (
          <Code2 className="size-4 text-[#52e0c4]" />
        )}
      </div>

      <div className="mt-3 space-y-3">
        {isEnglish ? (
          <>
            <TextInput
              label="Слово або фраза"
              value={english.lemma}
              onChange={(lemma) => {
                setEnglish((current) => ({ ...current, lemma }));
                resetLocalState();
              }}
              placeholder="flaky test"
            />
            <TextInput
              label="Значення"
              value={english.translation}
              onChange={(translation) =>
                setEnglish((current) => ({ ...current, translation }))
              }
              placeholder="нестабільний тест"
            />
            <TextInput
              label="Приклад"
              value={english.example}
              onChange={(example) =>
                setEnglish((current) => ({ ...current, example }))
              }
              placeholder="This flaky test fails only in CI."
            />
          </>
        ) : (
          <>
            <TextInput
              label="Термін"
              value={qa.term}
              onChange={(term) => {
                setQa((current) => ({ ...current, term }));
                resetLocalState();
              }}
              placeholder="Smoke testing"
            />
            <TextInput
              label="Пояснення"
              value={qa.definition}
              onChange={(definition) =>
                setQa((current) => ({ ...current, definition }))
              }
              placeholder="Швидка перевірка критичних функцій."
            />
            <TextInput
              label="Приклад"
              value={qa.example}
              onChange={(example) => setQa((current) => ({ ...current, example }))}
              placeholder="Після деплою запусти smoke-перевірки."
            />
          </>
        )}
      </div>

      {duplicateMatches.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[#8a6a2d] bg-[#231b0d] p-3 text-sm text-[#f7d58b]">
          <div className="flex items-center gap-2 font-semibold text-[#ffd98a]">
            <AlertCircle className="size-4" />
            Схожий запис уже є
          </div>
          <p className="mt-1 text-xs leading-5">
            {duplicateMatches.map((match) => match.note.title).join(", ")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              className="rounded-lg border border-[#8a6a2d] px-3 py-2 text-xs font-medium text-[#fff0c2] transition hover:bg-[#3a2e18]"
              disabled={!primaryDuplicate}
              onClick={() => {
                if (primaryDuplicate) onNoteSelect(primaryDuplicate.id);
              }}
              type="button"
            >
              Відкрити
            </button>
            <button
              className="rounded-lg border border-[#2dd4bf] bg-[#123129] px-3 py-2 text-xs font-semibold text-[#8df3dd] transition hover:bg-[#163b33] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!primaryDuplicate || !canSubmit || isBusy || isSubmitting}
              onClick={() => void mergeDuplicate()}
              type="button"
            >
              Оновити існуючий
            </button>
            <button
              className="rounded-lg bg-[#f2a84a] px-3 py-2 text-xs font-semibold text-[#071018] transition hover:bg-[#ffc063]"
              onClick={() => setAllowDuplicate(true)}
              type="button"
            >
              Додати все одно
            </button>
          </div>
        </div>
      ) : null}

      {previewCards.length > 0 ? (
        <details className="mt-3 rounded-lg border border-[#263140] bg-[#0b111a] p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#c7d0dd]">
            <Sparkles className="size-4 text-[#52e0c4]" />
            Картки: {previewCards.length}
          </summary>
          <div className="mt-3 space-y-2">
            {previewCards.map((card) => (
              <div
                key={card.type}
                className="rounded-md border border-[#202938] bg-[#101822] p-2"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-[#6f7d90]">
                  {labelCardType(card.type)}
                </p>
                <p className="mt-1 text-sm font-medium text-[#eef4ff]">
                  {card.prompt}
                </p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <button
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
        disabled={submitDisabled}
        onClick={() => void submit()}
        type="button"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {blockingDuplicate ? "Схожий запис" : "Додати"}
      </button>

      {localMessage ? (
        <p className="mt-3 rounded-lg border border-[#256b60] bg-[#102b27] px-3 py-2 text-sm text-[#8df3dd]">
          {localMessage}
        </p>
      ) : null}
    </section>
  );
}

function CsvImportPanel({
  importRuns,
  isBusy,
  moduleType,
  notes,
  onImport,
}: {
  importRuns: ImportRun[];
  isBusy: boolean;
  moduleType: ModuleType;
  notes: Note[];
  onImport: (
    rows: ClientImportCommitRow[],
    skipDuplicates: boolean,
    fileName: string | null,
  ) => Promise<ImportResultSummary>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const importableRows = preview
    ? preview.rows.filter(
        (row) =>
          row.draft &&
          (row.status === "ready" || (allowDuplicates && row.status === "duplicate")),
      )
    : [];
  const skippedByPreview =
    preview?.rows.filter((row) => row.status === "duplicate" && !allowDuplicates)
      .length ?? 0;
  const visibleIssues =
    preview?.rows
      .filter((row) => row.status !== "ready")
      .slice(0, 4) ?? [];
  const importTitle =
    moduleType === "english" ? "Імпорт слів" : "Імпорт QA-термінів";

  async function readFile(file: File) {
    setLocalMessage(null);
    setAllowDuplicates(false);

    if (file.size > 1024 * 1024) {
      setPreview(null);
      setFileName(file.name);
      setLocalMessage("Файл завеликий. Краще імпортувати до 1 MB за раз.");
      return;
    }

    const text = await file.text();
    setFileName(file.name);
    setPreview(parseCsvImport(text, moduleType, notes));
  }

  function downloadTemplate() {
    const blob = new Blob([csvTemplate(moduleType)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = moduleType === "english"
      ? "memora-english-template.csv"
      : "memora-qa-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitImport() {
    if (!preview || importableRows.length === 0 || isBusy || isImporting) return;

    setIsImporting(true);
    setLocalMessage(null);

    try {
      const result = await onImport(
        preview.rows.map((row) => ({
          rowNumber: row.rowNumber,
          draft: row.draft,
          errors: row.errors,
          raw: row.raw,
        })),
        !allowDuplicates,
        fileName,
      );
      setPreview(null);
      setFileName(null);
      setAllowDuplicates(false);
      setLocalMessage(
        result.skippedDuplicates > 0
          ? `Готово: додано ${result.importedCount}, пропущено схожих записів ${result.skippedDuplicates}, помилок ${result.invalidRows}.`
          : `Готово: додано ${result.importedCount}, помилок ${result.invalidRows}.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      // Parent surfaces the server action error.
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#eef4ff]">{importTitle}</p>
        <Upload className="size-4 text-[#52e0c4]" />
      </div>

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
        }}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={isBusy || isImporting}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <FileText className="size-4" />
          Файл
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
          onClick={downloadTemplate}
          type="button"
        >
          <Sparkles className="size-4" />
          Шаблон
        </button>
      </div>

      {fileName ? (
        <p className="mt-2 truncate text-xs text-[#9aa8ba]">{fileName}</p>
      ) : null}

      {preview ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Готові" value={preview.summary.ready.toString()} />
            <MiniStat label="Схожі" value={preview.summary.duplicates.toString()} />
            <MiniStat label="Помилки" value={preview.summary.invalid.toString()} />
          </div>

          {preview.summary.duplicates > 0 ? (
            <label className="flex items-center gap-2 rounded-lg border border-[#3a2e18] bg-[#15110a] px-3 py-2 text-sm text-[#f7d58b]">
              <input
                className="accent-[#f2a84a]"
                type="checkbox"
                checked={allowDuplicates}
                onChange={(event) => setAllowDuplicates(event.target.checked)}
              />
              Додати навіть схожі записи
            </label>
          ) : null}

          {visibleIssues.length > 0 ? (
            <div className="space-y-2">
              {visibleIssues.map((row) => (
                <div
                  key={row.rowNumber}
                  className="rounded-lg border border-[#263140] bg-[#0b111a] p-2 text-xs leading-5 text-[#9aa8ba]"
                >
                  <p className="font-medium text-[#c7d0dd]">Рядок {row.rowNumber}</p>
                  {row.errors.length > 0 ? (
                    <p>{row.errors.join(" ")}</p>
                  ) : (
                    <p>
                      Схожий запис:{" "}
                      {row.duplicateMatches
                        .map((match) => match.note.title)
                        .join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
            disabled={importableRows.length === 0 || isBusy || isImporting}
            onClick={() => void submitImport()}
            type="button"
          >
            {isImporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Додати {importableRows.length} з CSV
          </button>

          {skippedByPreview > 0 ? (
            <p className="text-xs leading-5 text-[#9aa8ba]">
              Схожі записи буде пропущено: {skippedByPreview}.
            </p>
          ) : null}
        </div>
      ) : null}

      {localMessage ? (
        <p className="mt-3 rounded-lg border border-[#263140] bg-[#151d28] px-3 py-2 text-sm leading-6 text-[#c7d0dd]">
          {localMessage}
        </p>
      ) : null}

      <ImportHistoryPanel importRuns={importRuns} moduleType={moduleType} />
    </div>
  );
}

function ImportHistoryPanel({
  importRuns,
  moduleType,
}: {
  importRuns: ImportRun[];
  moduleType: ModuleType;
}) {
  const visibleRuns = importRuns
    .filter((run) =>
      run.rows.length === 0
        ? true
        : run.rows.some((row) => !row.module || row.module === moduleType),
    );

  return (
    <div className="mt-4 border-t border-[#263140] pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#c7d0dd]">Історія</p>
        <span className="font-mono text-sm text-[#9aa8ba]">{visibleRuns.length}</span>
      </div>

      {visibleRuns.length === 0 ? (
        <div className="mt-3">
          <div className="rounded-lg border border-[#263140] bg-[#0b111a] p-5">
            <EmptyState
              icon={FileText}
              title="CSV ще не завантажували"
              description="Імпорти з'являться тут."
            />
          </div>
        </div>
      ) : (
        <div className="scrollbar-hidden mt-3 max-h-44 space-y-2 overflow-y-auto">
          {visibleRuns.map((run) => {
            const stats = importRunStats(run, moduleType);
            const issueRows = run.rows
              .filter(
                (row) =>
                  (!row.module || row.module === moduleType) &&
                  row.status !== "imported",
              )
              .slice(0, 2);

            return (
              <div
                key={run.id}
                className="rounded-lg border border-[#263140] bg-[#0b111a] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#eef4ff]">
                      {run.fileName}
                    </p>
                    <p className="mt-1 text-xs text-[#9aa8ba]">
                      {formatDate(run.createdAt)} / {labelImportStatus(run.status)}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#9aa8ba]">
                    {run.rowCount}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat label="Додано" value={stats.imported.toString()} />
                  <MiniStat label="Пропущено" value={stats.skipped.toString()} />
                  <MiniStat label="Помилки" value={stats.invalid.toString()} />
                </div>
                {issueRows.length > 0 ? (
                  <div className="mt-3 space-y-1 text-xs leading-5 text-[#9aa8ba]">
                    {issueRows.map((row) => (
                      <p key={row.id}>
                        Рядок {row.rowNumber}:{" "}
                        {row.errors.length > 0
                          ? row.errors.join(" ")
                          : labelImportRowStatus(row.status)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoteDetailPanel({
  cards,
  isBusy,
  moduleType,
  note,
  onNoteContentChange,
  onNoteDelete,
  onClose,
  onNoteStatusChange,
}: {
  cards: StudyCard[];
  isBusy: boolean;
  moduleType: ModuleType;
  note: Note | null;
  onClose: () => void;
  onNoteContentChange: (
    noteId: string,
    content: NoteContentDraft,
  ) => Promise<void>;
  onNoteDelete: (noteId: string) => Promise<void>;
  onNoteStatusChange: (noteId: string, status: ItemStatus) => void;
}) {
  if (!note) {
    return (
      <ShellPanel className="grid min-h-[520px] place-items-center p-6">
        <EmptyState
          icon={FileText}
          title="Матеріал не вибрано"
          description="Вибери матеріал зі списку."
        />
      </ShellPanel>
    );
  }

  return (
    <div className="p-1 sm:p-2">
      <div className="flex flex-col gap-4 border-b border-[#263140] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold">{note.title}</h2>
          <p className="mt-1 text-sm text-[#9aa8ba]">
            {moduleType === "english" ? "Англійська" : "QA"} / {formatDate(note.createdAt)}
          </p>
        </div>
        <StatusControls
          disabled={isBusy}
          status={note.status}
          onChange={(status) => onNoteStatusChange(note.id, status)}
          onDelete={() => {
            const shouldDelete = window.confirm(
              "Видалити цей матеріал разом з усіма його картками й історією повторень?",
            );
            if (!shouldDelete) return;

            void onNoteDelete(note.id).then(onClose).catch(() => undefined);
          }}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <NoteEditForm
          key={note.id}
          isBusy={isBusy}
          note={note}
          onSave={(content) => onNoteContentChange(note.id, content)}
        />

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Картки</h3>
              <p className="mt-1 text-sm text-[#9aa8ba]">{cards.length}</p>
            </div>
            <BookOpenCheck className="size-5 text-[#2dd4bf]" />
          </div>
          <div className="mt-4 space-y-3">
            {cards.length === 0 ? (
              <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-5">
                <EmptyState
                  icon={BookOpenCheck}
                  title="Карток для цього матеріалу немає"
                  description="Заповни поля й збережи."
                />
              </div>
            ) : (
              cards.map((card) => (
                <CardRow key={card.id} card={card} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteEditForm({
  isBusy,
  note,
  onSave,
}: {
  isBusy: boolean;
  note: Note;
  onSave: (content: NoteContentDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<NoteContentDraft>(() => ({ ...note.content }));
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(note.content);

  const canSave =
    note.module === "english"
      ? textValue(draft.lemma_en) && textValue(draft.translation_uk)
      : textValue(draft.term) && textValue(draft.short_definition);

  function quickFixDraft() {
    if (note.module === "english") {
      setDraft((current) => ({
        ...current,
        lemma_en: textValue(current.lemma_en).trim(),
        translation_uk: textValue(current.translation_uk).trim(),
        part_of_speech: textValue(current.part_of_speech).trim() || "phrase",
        example_en: normalizeSentence(textValue(current.example_en)),
      }));
      return;
    }

    setDraft((current) => ({
      ...current,
      term: textValue(current.term).trim(),
      short_definition: normalizeSentence(textValue(current.short_definition)),
      example: normalizeSentence(textValue(current.example)),
    }));
  }

  async function save() {
    if (!canSave || isBusy || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Зміст</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4] sm:w-auto"
            disabled={isBusy || isSaving}
            onClick={quickFixDraft}
            type="button"
          >
            <Sparkles className="size-4" />
            Очистити
          </button>
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-3 py-2 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab] sm:w-auto"
            disabled={!canSave || !hasChanges || isBusy || isSaving}
            onClick={() => void save()}
            type="button"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Зберегти
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {note.module === "english" ? (
          <>
            <TextInput
              label="Слово або фраза"
              value={textValue(draft.lemma_en)}
              onChange={(lemma_en) =>
                setDraft((current) => ({ ...current, lemma_en }))
              }
              placeholder="bug"
            />
            <TextInput
              label="Значення"
              value={textValue(draft.translation_uk)}
              onChange={(translation_uk) =>
                setDraft((current) => ({ ...current, translation_uk }))
              }
              placeholder="дефект у програмі"
            />
            <TextInput
              label="Частина мови"
              value={textValue(draft.part_of_speech)}
              onChange={(part_of_speech) =>
                setDraft((current) => ({ ...current, part_of_speech }))
              }
              placeholder="phrase"
            />
            <TextArea
              label="Приклад"
              value={textValue(draft.example_en)}
              onChange={(example_en) =>
                setDraft((current) => ({ ...current, example_en }))
              }
              placeholder="I found a bug in the checkout flow."
            />
          </>
        ) : (
          <>
            <TextInput
              label="Термін"
              value={textValue(draft.term)}
              onChange={(term) => setDraft((current) => ({ ...current, term }))}
              placeholder="Regression testing"
            />
            <TextArea
              label="Пояснення"
              value={textValue(draft.short_definition)}
              onChange={(short_definition) =>
                setDraft((current) => ({ ...current, short_definition }))
              }
              placeholder="Перевірка, що вже робочий функціонал не зламався після змін."
            />
            <TextArea
              label="Приклад"
              value={textValue(draft.example)}
              onChange={(example) =>
                setDraft((current) => ({ ...current, example }))
              }
              placeholder="Після фікса checkout перевір payment і cart сценарії."
            />
          </>
        )}
      </div>
    </div>
  );
}

function CardRow({ card }: { card: StudyCard }) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{labelCardType(card.type)}</Badge>
        <span className="font-mono text-xs text-[#9aa8ba]">
          наступний раз: {formatDate(card.schedule.due)}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        <CardField label="Питання" value={card.prompt} strong />
        <CardField label="Відповідь" value={card.answer} />
        {card.explanation ? (
          <CardField label="Пояснення" value={card.explanation} />
        ) : null}
      </div>
    </div>
  );
}

function CardField({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#6f7d90]">
        {label}
      </p>
      <p
        className={`mt-1 text-sm leading-6 ${
          strong ? "font-medium text-[#eef4ff]" : "text-[#c7d0dd]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusControls({
  disabled,
  status,
  onChange,
  onDelete,
}: {
  disabled: boolean;
  status: ItemStatus;
  onChange: (status: ItemStatus) => void;
  onDelete: () => void;
}) {
  const controls = [
    { status: "active" as const, label: "В навчанні", icon: PlayCircle },
    { status: "suspended" as const, label: "Пауза", icon: PauseCircle },
  ];

  return (
    <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
      {controls.map((control) => {
        const Icon = control.icon;
        const isActive = status === control.status;

        return (
          <button
            key={control.status}
            className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${
              isActive
                ? "border-[#2dd4bf] bg-[#14352f] text-[#52e0c4]"
                : "border-[#263140] text-[#9aa8ba] hover:bg-[#151d28]"
            }`}
            disabled={disabled || isActive}
            onClick={() => onChange(control.status)}
            title={control.label}
            type="button"
          >
            <Icon className="size-4" />
            <span>{control.label}</span>
          </button>
        );
      })}
      <button
        className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#4a2428] px-3 py-2 text-sm font-medium text-[#ff8d7f] transition hover:border-[#ef6351] hover:bg-[#2a1518] disabled:cursor-not-allowed disabled:opacity-55"
        disabled={disabled}
        onClick={onDelete}
        title="Видалити матеріал"
        type="button"
      >
        <Trash2 className="size-4" />
        <span>Видалити</span>
      </button>
    </div>
  );
}
