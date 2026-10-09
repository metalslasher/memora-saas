"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  Check,
  ChevronDown,
  Download,
  FileText,
  FileUp,
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
import {
  csvTemplate,
  parseCsvImport,
  type CsvImportPreview,
} from "@/lib/memora/csv-import";
import { findDuplicateNotes } from "@/lib/memora/duplicates";
import type { NoteContentDraft } from "@/lib/memora/remote-store";
import type {
  ImportRun,
  ModuleType,
  Note,
  ReviewLog,
  StudyCard,
} from "@/lib/memora/types";
import {
  Badge,
  Button,
  Dialog,
  DialogHeader,
  EmptyState,
  MiniStat,
  PageHeader,
  StatusBanner,
  TextArea,
  TextInput,
} from "./shared-ui";
import { SpeakButton } from "./speech";
import type { ClientImportCommitRow, ImportResultSummary, ItemStatus } from "./types";
import {
  downloadTextFile,
  formatDate,
  importRunStats,
  labelCardType,
  labelImportRowStatus,
  labelImportStatus,
  labelSource,
  noteMatchesQuery,
  plural,
  statusRank,
  textValue,
} from "./utils";

type Filter = "all" | "active" | "suspended" | "weak";

const moduleCopy: Record<
  ModuleType,
  { title: string; noun: [string, string, string]; addLabel: string; emptyTitle: string; emptyText: string }
> = {
  english: {
    title: "Англійські слова",
    noun: ["слово", "слова", "слів"],
    addLabel: "Додати слово",
    emptyTitle: "Словник поки порожній",
    emptyText: "Додай перше слово чи фразу — Memora зробить дві картки: з англійської й на англійську.",
  },
  qa: {
    title: "QA-терміни",
    noun: ["термін", "терміни", "термінів"],
    addLabel: "Додати термін",
    emptyTitle: "Термінів поки немає",
    emptyText: "Додай перший QA-термін — Memora зробить картки «пояснити термін» і «згадати термін».",
  },
};

export function ContentManager({
  cards,
  imports,
  isBusy,
  moduleType,
  notes,
  reviewLogs,
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
  reviewLogs: ReviewLog[];
  selectedNote: Note | null;
  onAddEnglish: (draft: EnglishDraft) => Promise<void>;
  onAddQa: (draft: QaDraft) => Promise<void>;
  onImport: (
    rows: ClientImportCommitRow[],
    skipDuplicates: boolean,
    fileName: string | null,
  ) => Promise<ImportResultSummary>;
  onNoteContentChange: (noteId: string, content: NoteContentDraft) => Promise<void>;
  onNoteDelete: (noteId: string) => Promise<void>;
  onNoteSelect: (noteId: string | null) => void;
  onNoteStatusChange: (noteId: string, status: ItemStatus) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<"add" | "import" | null>(null);
  const copy = moduleCopy[moduleType];

  const cardsByNote = useMemo(() => {
    const map = new Map<string, StudyCard[]>();
    for (const card of cards) {
      const list = map.get(card.noteId) ?? [];
      list.push(card);
      map.set(card.noteId, list);
    }
    return map;
  }, [cards]);

  const normalizedQuery = query.trim().toLowerCase();
  const sortedNotes = useMemo(
    () =>
      [...notes].sort(
        (a, b) =>
          statusRank(a.status) - statusRank(b.status) ||
          b.createdAt.localeCompare(a.createdAt),
      ),
    [notes],
  );
  const visibleNotes = sortedNotes.filter((note) => {
    if (normalizedQuery && !noteMatchesQuery(note, normalizedQuery)) return false;
    if (filter === "active") return note.status === "active";
    if (filter === "suspended") return note.status !== "active";
    if (filter === "weak") {
      return (cardsByNote.get(note.id) ?? []).some((card) => card.schedule.lapses >= 2);
    }
    return true;
  });
  const activeCardCount = cards.filter(
    (card) => card.module === moduleType && card.status === "active",
  ).length;
  const counts: Record<Filter, number> = {
    all: notes.length,
    active: notes.filter((note) => note.status === "active").length,
    suspended: notes.filter((note) => note.status !== "active").length,
    weak: notes.filter((note) =>
      (cardsByNote.get(note.id) ?? []).some((card) => card.schedule.lapses >= 2),
    ).length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={copy.title}
        description={`${plural(notes.length, copy.noun)} · ${plural(activeCardCount, ["картка", "картки", "карток"])} у навчанні`}
        action={
          <>
            <Button icon={Upload} onClick={() => setPanel("import")}>
              <span className="hidden sm:inline">Імпорт</span>
              <span className="sr-only sm:hidden">Імпорт CSV</span>
            </Button>
            <Button icon={Plus} variant="primary" onClick={() => setPanel("add")}>
              {copy.addLabel}
            </Button>
          </>
        }
      />

      {notes.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex h-11 min-w-0 shrink-0 items-center gap-2.5 md:flex-1 rounded-xl border border-line-strong bg-surface-1 px-3.5 text-sm transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
            <Search className="size-4 shrink-0 text-faint" />
            <input
              aria-label="Пошук"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-faint md:text-sm"
              placeholder={moduleType === "english" ? "Знайти слово чи переклад" : "Знайти термін"}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                aria-label="Очистити пошук"
                className="text-faint hover:text-text"
                onClick={() => setQuery("")}
                type="button"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
          <div className="scrollbar-hidden -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
            {(
              [
                ["all", "Усі"],
                ["active", "В навчанні"],
                ["suspended", "На паузі"],
                ["weak", "Складні"],
              ] as Array<[Filter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                  filter === value
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-line text-muted hover:text-text"
                }`}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
                <span className="font-mono text-[11px] opacity-70">{counts[value]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong px-6 py-14">
          <EmptyState
            icon={FileText}
            title={copy.emptyTitle}
            description={copy.emptyText}
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button icon={Plus} variant="primary" onClick={() => setPanel("add")}>
                  {copy.addLabel}
                </Button>
                <Button icon={Upload} onClick={() => setPanel("import")}>
                  Імпорт з CSV
                </Button>
              </div>
            }
          />
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="rounded-3xl border border-line px-6 py-12">
          <EmptyState
            icon={Search}
            title="Нічого не знайдено"
            description="Спробуй інший запит або зміни фільтр."
          />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface-2/50">
          {visibleNotes.map((note, index) => (
            <NoteRow
              key={note.id}
              cards={cardsByNote.get(note.id) ?? []}
              isFirst={index === 0}
              note={note}
              onClick={() => onNoteSelect(note.id)}
            />
          ))}
        </ul>
      )}

      {panel === "add" ? (
        <Dialog label={copy.addLabel} size="lg" onClose={() => setPanel(null)}>
          <DialogHeader
            title={copy.addLabel}
            subtitle="Картки створяться автоматично й одразу потраплять у практику."
            onClose={() => setPanel(null)}
          />
          <div className="overflow-y-auto">
            <NewMaterialForm
              isBusy={isBusy}
              moduleType={moduleType}
              notes={notes}
              onAddEnglish={onAddEnglish}
              onAddQa={onAddQa}
              onMergeDuplicate={onNoteContentChange}
              onOpenNote={(noteId) => {
                setPanel(null);
                onNoteSelect(noteId);
              }}
            />
          </div>
        </Dialog>
      ) : null}

      {panel === "import" ? (
        <Dialog label="Імпорт з CSV" size="lg" onClose={() => setPanel(null)}>
          <DialogHeader
            title="Імпорт з CSV"
            subtitle="Додай цілий список за раз — з Google Таблиць чи Excel."
            onClose={() => setPanel(null)}
          />
          <div className="overflow-y-auto">
            <CsvImportPanel
              importRuns={imports}
              isBusy={isBusy}
              moduleType={moduleType}
              notes={notes}
              onImport={onImport}
            />
          </div>
        </Dialog>
      ) : null}

      {selectedNote ? (
        <Dialog label="Матеріал" size="xl" onClose={() => onNoteSelect(null)}>
          <NoteDetail
            cards={[...(cardsByNote.get(selectedNote.id) ?? [])].sort(
              (a, b) => statusRank(a.status) - statusRank(b.status),
            )}
            isBusy={isBusy}
            note={selectedNote}
            reviewLogs={reviewLogs}
            onClose={() => onNoteSelect(null)}
            onNoteContentChange={onNoteContentChange}
            onNoteDelete={onNoteDelete}
            onNoteStatusChange={onNoteStatusChange}
          />
        </Dialog>
      ) : null}
    </div>
  );
}

function noteSubtitle(note: Note) {
  return note.module === "english"
    ? textValue(note.content.translation_uk)
    : textValue(note.content.short_definition);
}

function noteProgress(cards: StudyCard[]) {
  const active = cards.filter((card) => card.status === "active");
  if (active.length === 0) return { label: "—", level: 0 };
  if (active.every((card) => card.schedule.reps === 0)) return { label: "нове", level: 0 };
  const minDays = Math.min(...active.map((card) => card.schedule.scheduled_days));
  if (minDays >= 21) return { label: "закріплено", level: 3 };
  if (minDays >= 3) return { label: "вчиться", level: 2 };
  return { label: "початок", level: 1 };
}

function NoteRow({
  cards,
  isFirst,
  note,
  onClick,
}: {
  cards: StudyCard[];
  isFirst: boolean;
  note: Note;
  onClick: () => void;
}) {
  const progress = noteProgress(cards);
  const isPaused = note.status !== "active";
  const lapses = Math.max(0, ...cards.map((card) => card.schedule.lapses));

  return (
    <li className={isFirst ? "" : "border-t border-line"}>
      <button
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-surface-3/50 md:px-5"
        onClick={onClick}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[15px] font-semibold ${isPaused ? "text-muted" : "text-text"}`}
          >
            {note.title}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{noteSubtitle(note) || "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isPaused ? <Badge tone="neutral">пауза</Badge> : null}
          {lapses >= 2 && !isPaused ? <Badge tone="red">складне</Badge> : null}
          <span
            className="hidden w-24 items-center justify-end gap-2 text-xs text-faint sm:flex"
            title={`Прогрес: ${progress.label}`}
          >
            {progress.label}
            <span className="flex gap-0.5">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-3 w-1 rounded-full ${
                    progress.level >= step ? "bg-accent" : "bg-surface-4"
                  }`}
                />
              ))}
            </span>
          </span>
        </div>
      </button>
    </li>
  );
}

function NewMaterialForm({
  isBusy,
  moduleType,
  notes,
  onAddEnglish,
  onAddQa,
  onMergeDuplicate,
  onOpenNote,
}: {
  isBusy: boolean;
  moduleType: ModuleType;
  notes: Note[];
  onAddEnglish: (draft: EnglishDraft) => Promise<void>;
  onAddQa: (draft: QaDraft) => Promise<void>;
  onMergeDuplicate: (noteId: string, content: NoteContentDraft) => Promise<void>;
  onOpenNote: (noteId: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [english, setEnglish] = useState<EnglishDraft>({ lemma: "", translation: "", example: "" });
  const [qa, setQa] = useState<QaDraft>({ term: "", definition: "", example: "" });
  const normalizedEnglish = useMemo(() => normalizeEnglishDraft(english), [english]);
  const normalizedQa = useMemo(() => normalizeQaDraft(qa), [qa]);
  const isEnglish = moduleType === "english";
  const canSubmit = isEnglish
    ? Boolean(normalizedEnglish.lemma && normalizedEnglish.translation)
    : Boolean(normalizedQa.term && normalizedQa.definition);
  const previewCards = useMemo(
    () => (isEnglish ? generateEnglishCards(normalizedEnglish) : generateQaCards(normalizedQa)),
    [isEnglish, normalizedEnglish, normalizedQa],
  );
  const duplicateMatches = useMemo(
    () =>
      isEnglish
        ? findDuplicateNotes(notes, { module: "english", lemma: normalizedEnglish.lemma })
        : findDuplicateNotes(notes, { module: "qa", term: normalizedQa.term }),
    [isEnglish, normalizedEnglish.lemma, normalizedQa.term, notes],
  );
  const blockingDuplicate = duplicateMatches.length > 0 && !allowDuplicate;
  const submitDisabled = !canSubmit || blockingDuplicate || isBusy || isSubmitting;
  const primaryDuplicate = duplicateMatches.at(0)?.note ?? null;

  function resetForm(title: string) {
    setEnglish({ lemma: "", translation: "", example: "" });
    setQa({ term: "", definition: "", example: "" });
    setAllowDuplicate(false);
    setAdded((current) => [title, ...current].slice(0, 6));
    setFormKey((value) => value + 1);
  }

  async function submit() {
    if (submitDisabled) return;
    setIsSubmitting(true);

    try {
      if (isEnglish) {
        await onAddEnglish(normalizedEnglish);
        resetForm(normalizedEnglish.lemma);
      } else {
        await onAddQa(normalizedQa);
        resetForm(normalizedQa.term);
      }
    } catch {
      // The app shows the error toast.
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mergeDuplicate() {
    if (!primaryDuplicate || !canSubmit || isBusy || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onMergeDuplicate(
        primaryDuplicate.id,
        isEnglish ? englishContentFromDraft(normalizedEnglish) : qaContentFromDraft(normalizedQa),
      );
      onOpenNote(primaryDuplicate.id);
    } catch {
      // The app shows the error toast.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div key={formKey} className="space-y-4">
        {isEnglish ? (
          <>
            <TextInput
              autoComplete="off"
              autoFocus
              label="Англійською"
              placeholder="flaky test"
              value={english.lemma}
              onChange={(lemma) => {
                setEnglish((current) => ({ ...current, lemma }));
                setAllowDuplicate(false);
              }}
            />
            <TextInput
              autoComplete="off"
              hint="кілька варіантів — через кому"
              label="Переклад"
              placeholder="нестабільний тест"
              value={english.translation}
              onChange={(translation) => setEnglish((current) => ({ ...current, translation }))}
            />
            <TextInput
              autoComplete="off"
              hint="необов’язково"
              label="Приклад речення"
              placeholder="This flaky test fails only in CI."
              value={english.example}
              onChange={(example) => setEnglish((current) => ({ ...current, example }))}
            />
          </>
        ) : (
          <>
            <TextInput
              autoComplete="off"
              autoFocus
              label="Термін"
              placeholder="Smoke testing"
              value={qa.term}
              onChange={(term) => {
                setQa((current) => ({ ...current, term }));
                setAllowDuplicate(false);
              }}
            />
            <TextArea
              label="Пояснення своїми словами"
              placeholder="Швидка перевірка, що ключові функції працюють після збірки."
              rows={2}
              value={qa.definition}
              onChange={(definition) => setQa((current) => ({ ...current, definition }))}
            />
            <TextInput
              autoComplete="off"
              hint="необов’язково"
              label="Приклад"
              placeholder="Після деплою запускаємо smoke-перевірки."
              value={qa.example}
              onChange={(example) => setQa((current) => ({ ...current, example }))}
            />
          </>
        )}
      </div>

      {duplicateMatches.length > 0 && !allowDuplicate ? (
        <div className="rounded-2xl border border-amber/30 bg-amber-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber">
            <AlertCircle className="size-4" />
            Схоже, це вже є: {duplicateMatches.map((match) => match.note.title).join(", ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!primaryDuplicate}
              onClick={() => primaryDuplicate && onOpenNote(primaryDuplicate.id)}
            >
              Відкрити
            </Button>
            <Button
              size="sm"
              variant="soft"
              disabled={!primaryDuplicate || !canSubmit || isBusy || isSubmitting}
              onClick={() => void mergeDuplicate()}
            >
              Оновити наявний
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAllowDuplicate(true)}>
              Додати все одно
            </Button>
          </div>
        </div>
      ) : null}

      {previewCards.length > 0 ? (
        <details className="group rounded-2xl border border-line bg-surface-1">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-text-2 [&::-webkit-details-marker]:hidden">
            <Sparkles className="size-4 text-accent" />
            Буде створено {previewCards.length} картки
            <ChevronDown className="ml-auto size-4 text-faint transition group-open:rotate-180" />
          </summary>
          <div className="space-y-2 px-4 pb-4">
            {previewCards.map((card) => (
              <div key={card.type} className="rounded-xl border border-line bg-surface-2 p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                  {labelCardType(card.type)}
                </p>
                <p className="mt-1 text-sm text-text">{card.prompt}</p>
                <p className="mt-1 text-sm text-accent">{card.answer}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <Button
        className="w-full"
        disabled={submitDisabled}
        icon={Plus}
        isLoading={isSubmitting}
        size="lg"
        type="submit"
        variant="primary"
      >
        Додати
      </Button>

      {added.length > 0 ? (
        <div className="animate-rise rounded-2xl border border-accent/20 bg-accent-soft/60 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-accent">
            <Check className="size-4" />
            Додано. Можна вводити наступне.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {added.map((title, index) => (
              <span key={`${title}-${index}`} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-2">
                {title}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </form>
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
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const importableRows = preview
    ? preview.rows.filter(
        (row) =>
          row.draft && (row.status === "ready" || (allowDuplicates && row.status === "duplicate")),
      )
    : [];
  const issues = preview?.rows.filter((row) => row.status !== "ready").slice(0, 5) ?? [];

  async function readFile(file: File) {
    setMessage(null);
    setAllowDuplicates(false);
    setFileName(file.name);

    if (file.size > 1024 * 1024) {
      setPreview(null);
      setMessage({ tone: "error", text: "Файл завеликий — до 1 МБ за раз." });
      return;
    }

    setPreview(parseCsvImport(await file.text(), moduleType, notes));
  }

  async function submitImport() {
    if (!preview || importableRows.length === 0 || isBusy || isImporting) return;
    setIsImporting(true);
    setMessage(null);

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
      setMessage({
        tone: "success",
        text: `Додано ${result.importedCount}${
          result.skippedDuplicates ? `, пропущено схожих ${result.skippedDuplicates}` : ""
        }${result.invalidRows ? `, з помилками ${result.invalidRows}` : ""}.`,
      });
    } catch {
      // The app shows the error toast.
    } finally {
      setIsImporting(false);
    }
  }

  const visibleRuns = importRuns.filter((run) =>
    run.rows.length === 0 ? true : run.rows.some((row) => !row.module || row.module === moduleType),
  );

  return (
    <div className="space-y-4 p-5">
      <input
        ref={fileInputRef}
        accept=".csv,text/csv,text/plain"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void readFile(file);
        }}
      />

      <button
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          isDragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent/50"
        }`}
        disabled={isBusy || isImporting}
        onClick={() => fileInputRef.current?.click()}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void readFile(file);
        }}
        type="button"
      >
        <FileUp className="size-6 text-accent" />
        <span className="text-sm font-semibold">
          {fileName ?? "Обери CSV-файл або перетягни сюди"}
        </span>
        <span className="text-xs text-muted">
          {moduleType === "english"
            ? "Колонки: слово, переклад, приклад"
            : "Колонки: термін, пояснення, приклад"}
        </span>
      </button>

      <button
        className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-strong"
        onClick={() =>
          downloadTextFile(
            moduleType === "english" ? "memora-english-template.csv" : "memora-qa-template.csv",
            csvTemplate(moduleType),
            "text/csv;charset=utf-8",
          )
        }
        type="button"
      >
        <Download className="size-4" />
        Завантажити шаблон
      </button>

      {preview ? (
        <div className="animate-rise space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="готові" value={preview.summary.ready.toString()} />
            <MiniStat label="схожі на наявні" value={preview.summary.duplicates.toString()} />
            <MiniStat label="з помилками" value={preview.summary.invalid.toString()} />
          </div>

          {preview.summary.duplicates > 0 ? (
            <label className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-1 px-3 py-2.5 text-sm text-text-2">
              <input
                checked={allowDuplicates}
                className="size-4 accent-[var(--accent)]"
                type="checkbox"
                onChange={(event) => setAllowDuplicates(event.target.checked)}
              />
              Додати й схожі записи
            </label>
          ) : null}

          {issues.length > 0 ? (
            <ul className="space-y-1.5 text-xs leading-5 text-muted">
              {issues.map((row) => (
                <li key={row.rowNumber} className="rounded-lg bg-surface-1 px-3 py-2">
                  <span className="font-medium text-text-2">Рядок {row.rowNumber}: </span>
                  {row.errors.length > 0
                    ? row.errors.join(" ")
                    : `схоже на «${row.duplicateMatches.map((match) => match.note.title).join(", ")}»`}
                </li>
              ))}
            </ul>
          ) : null}

          <Button
            className="w-full"
            disabled={importableRows.length === 0 || isBusy || isImporting}
            icon={Check}
            isLoading={isImporting}
            size="lg"
            variant="primary"
            onClick={() => void submitImport()}
          >
            Додати {importableRows.length}
          </Button>
        </div>
      ) : null}

      {message ? <StatusBanner tone={message.tone} message={message.text} /> : null}

      {visibleRuns.length > 0 ? (
        <details className="group rounded-2xl border border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-text-2 [&::-webkit-details-marker]:hidden">
            Історія імпорту
            <span className="font-mono text-xs text-faint">{visibleRuns.length}</span>
            <ChevronDown className="ml-auto size-4 text-faint transition group-open:rotate-180" />
          </summary>
          <ul className="scrollbar-soft max-h-64 divide-y divide-line overflow-y-auto border-t border-line">
            {visibleRuns.map((run) => {
              const stats = importRunStats(run, moduleType);
              const problem = run.rows.find(
                (row) => (!row.module || row.module === moduleType) && row.status !== "imported",
              );
              return (
                <li key={run.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{run.fileName}</p>
                    <span className="shrink-0 text-xs text-faint">{formatDate(run.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {labelImportStatus(run.status)} · додано {stats.imported} · пропущено{" "}
                    {stats.skipped} · помилок {stats.invalid}
                  </p>
                  {problem ? (
                    <p className="mt-1 text-xs text-faint">
                      Рядок {problem.rowNumber}:{" "}
                      {problem.errors.length > 0
                        ? problem.errors.join(" ")
                        : labelImportRowStatus(problem.status)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function NoteDetail({
  cards,
  isBusy,
  note,
  reviewLogs,
  onClose,
  onNoteContentChange,
  onNoteDelete,
  onNoteStatusChange,
}: {
  cards: StudyCard[];
  isBusy: boolean;
  note: Note;
  reviewLogs: ReviewLog[];
  onClose: () => void;
  onNoteContentChange: (noteId: string, content: NoteContentDraft) => Promise<void>;
  onNoteDelete: (noteId: string) => Promise<void>;
  onNoteStatusChange: (noteId: string, status: ItemStatus) => void;
}) {
  const logs = reviewLogs.filter((log) => log.noteId === note.id);
  const correct = logs.filter((log) => log.wasCorrect).length;
  const isActive = note.status === "active";

  return (
    <>
      <DialogHeader
        title={
          <span className="flex items-center gap-2">
            {note.title}
            {note.module === "english" ? <SpeakButton className="-my-2" text={note.title} /> : null}
          </span>
        }
        subtitle={`${labelSource(note.source)} · ${formatDate(note.createdAt)}${
          logs.length ? ` · ${logs.length} відповідей, згадано ${Math.round((correct / logs.length) * 100)}%` : ""
        }`}
        onClose={onClose}
      />
      <div className="overflow-y-auto">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <NoteEditForm
              key={`${note.id}:${JSON.stringify(note.content)}`}
              isBusy={isBusy}
              note={note}
              onSave={(content) => onNoteContentChange(note.id, content)}
            />
            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
              <Button
                disabled={isBusy}
                icon={isActive ? PauseCircle : PlayCircle}
                size="sm"
                onClick={() => onNoteStatusChange(note.id, isActive ? "suspended" : "active")}
              >
                {isActive ? "Поставити на паузу" : "Повернути в навчання"}
              </Button>
              <Button
                disabled={isBusy}
                icon={Trash2}
                size="sm"
                variant="danger"
                onClick={() => {
                  const confirmed = window.confirm(
                    `Видалити «${note.title}» разом з картками й історією повторень?`,
                  );
                  if (confirmed) void onNoteDelete(note.id).then(onClose).catch(() => undefined);
                }}
              >
                Видалити
              </Button>
            </div>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-2">
              <BookOpenCheck className="size-4 text-accent" />
              Картки
            </h3>
            <div className="mt-3 space-y-2.5">
              {cards.length === 0 ? (
                <p className="rounded-xl border border-line p-4 text-sm text-muted">
                  Карток немає — заповни поля й збережи.
                </p>
              ) : (
                cards.map((card) => <CardRow key={card.id} card={card} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </>
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
      ? textValue(draft.lemma_en).trim() && textValue(draft.translation_uk).trim()
      : textValue(draft.term).trim() && textValue(draft.short_definition).trim();

  function field(key: string) {
    return {
      value: textValue(draft[key]),
      onChange: (value: string) => setDraft((current) => ({ ...current, [key]: value })),
    };
  }

  async function save() {
    if (!canSave || isBusy || isSaving) return;
    setIsSaving(true);
    try {
      const clean = Object.fromEntries(
        Object.entries(draft).map(([key, value]) => [
          key,
          typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
        ]),
      );
      await onSave(clean);
    } catch {
      // The app shows the error toast.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {note.module === "english" ? (
        <>
          <TextInput label="Англійською" {...field("lemma_en")} />
          <TextInput hint="варіанти — через кому" label="Переклад" {...field("translation_uk")} />
          <TextInput hint="noun, verb, phrase…" label="Частина мови" {...field("part_of_speech")} />
          <TextArea label="Приклад речення" rows={2} {...field("example_en")} />
        </>
      ) : (
        <>
          <TextInput label="Термін" {...field("term")} />
          <TextArea label="Пояснення" rows={3} {...field("short_definition")} />
          <TextArea label="Приклад" rows={2} {...field("example")} />
        </>
      )}
      <Button
        disabled={!canSave || !hasChanges || isBusy || isSaving}
        icon={Save}
        isLoading={isSaving}
        type="submit"
        variant="primary"
      >
        Зберегти зміни
      </Button>
      {hasChanges ? (
        <p className="text-xs text-faint">Картки оновляться, прогрес повторень збережеться.</p>
      ) : null}
    </form>
  );
}

function CardRow({ card }: { card: StudyCard }) {
  const due = new Date(card.schedule.due);
  const [now] = useState(() => Date.now());
  const isDue = due.getTime() <= now;

  return (
    <div className={`rounded-xl border border-line bg-surface-1 p-4 ${card.status !== "active" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
          {labelCardType(card.type)}
        </span>
        <span className="text-xs text-muted">
          {card.status !== "active"
            ? "на паузі"
            : card.schedule.reps === 0
              ? "ще не вивчалась"
              : isDue
                ? "пора повторити"
                : `далі: ${formatDate(card.schedule.due)}`}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-text">{card.prompt}</p>
      <p className="mt-1 text-sm text-accent">{card.answer}</p>
    </div>
  );
}
