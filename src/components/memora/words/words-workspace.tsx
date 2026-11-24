"use client";

import { FileText, Plus, ScanText, Search, Upload, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { AiStatus } from "@/lib/memora/ai/service";
import type { WordListItem } from "@/lib/memora/types";
import { Badge, Button, Dialog, DialogHeader, EmptyState, PageHeader } from "../shared-ui";
import { useFreshSnapshot } from "../use-fresh-snapshot";
import { plural } from "../utils";
import { AddWordForm } from "./add-word-form";
import { CsvImportPanel } from "./csv-import-panel";
import { FromTextPanel } from "./from-text-panel";

type Filter = "all" | "active" | "paused" | "weak";

const filters: Array<[Filter, string]> = [
  ["all", "Усі"],
  ["active", "У навчанні"],
  ["paused", "На паузі"],
  ["weak", "Складні"],
];

function matchesFilter(word: WordListItem, filter: Filter) {
  if (filter === "active") return word.status === "active";
  if (filter === "paused") return word.status !== "active";
  if (filter === "weak") return word.maxLapses >= 2;
  return true;
}

export function WordsWorkspace({
  ai,
  initialWords,
  snapshot,
}: {
  ai: AiStatus;
  initialWords: WordListItem[];
  snapshot: string;
}) {
  useFreshSnapshot(snapshot);
  const [words, setWords] = useState(initialWords);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<"add" | "import" | "text" | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleWords = useMemo(
    () =>
      words.filter(
        (word) =>
          matchesFilter(word, filter) &&
          (!normalizedQuery ||
            word.lemma.toLowerCase().includes(normalizedQuery) ||
            word.translation.toLowerCase().includes(normalizedQuery)),
      ),
    [filter, normalizedQuery, words],
  );
  const activeCount = words.filter((word) => word.status === "active").length;

  function addWords(added: WordListItem[]) {
    setWords((current) => [...added, ...current]);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Слова"
        description={`${plural(words.length, ["слово", "слова", "слів"])} · ${activeCount} у навчанні`}
        action={
          <>
            <Button icon={Upload} onClick={() => setPanel("import")}>
              <span className="hidden sm:inline">Імпорт</span>
              <span className="sr-only sm:hidden">Імпорт CSV</span>
            </Button>
            {ai.enabled ? (
              <Button icon={ScanText} onClick={() => setPanel("text")}>
                З тексту
              </Button>
            ) : null}
            <Button icon={Plus} variant="primary" onClick={() => setPanel("add")}>
              Додати слово
            </Button>
          </>
        }
      />

      {words.length > 0 ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex h-11 min-w-0 shrink-0 items-center gap-2.5 rounded-xl border border-line-strong bg-surface-1 px-3.5 text-sm transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 md:flex-1">
            <Search className="size-4 shrink-0 text-faint" />
            <input
              aria-label="Пошук"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-faint md:text-sm"
              placeholder="Знайти слово чи переклад"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button aria-label="Очистити пошук" className="text-faint hover:text-text" onClick={() => setQuery("")} type="button">
                <X className="size-4" />
              </button>
            ) : null}
          </label>
          <div className="scrollbar-hidden -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
            {filters.map(([value, label]) => (
              <button
                key={value}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                  filter === value ? "border-accent/40 bg-accent-soft text-accent" : "border-line text-muted hover:text-text"
                }`}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
                <span className="font-mono text-[11px] opacity-70">
                  {words.filter((word) => matchesFilter(word, value)).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {words.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong px-6 py-14">
          <EmptyState
            icon={FileText}
            title="Слів поки немає"
            description="Додай перше слово чи фразу — Memora зробить дві картки: з англійської й на англійську."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button icon={Plus} variant="primary" onClick={() => setPanel("add")}>
                  Додати слово
                </Button>
                <Button icon={Upload} onClick={() => setPanel("import")}>
                  Імпорт з CSV
                </Button>
              </div>
            }
          />
        </div>
      ) : visibleWords.length === 0 ? (
        <div className="rounded-3xl border border-line px-6 py-12">
          <EmptyState icon={Search} title="Нічого не знайдено" description="Спробуй інший запит або зміни фільтр." />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface-2/50">
          {visibleWords.map((word, index) => (
            <WordRow key={word.id} isFirst={index === 0} word={word} />
          ))}
        </ul>
      )}

      {panel === "add" ? (
        <Dialog label="Додати слово" size="lg" onClose={() => setPanel(null)}>
          <DialogHeader
            title="Додати слово"
            subtitle="Картки створяться автоматично й одразу потраплять у практику."
            onClose={() => setPanel(null)}
          />
          <div className="overflow-y-auto">
            <AddWordForm ai={ai} words={words} onAdded={(word) => addWords([word])} />
          </div>
        </Dialog>
      ) : null}

      {panel === "text" ? (
        <Dialog label="Слова з тексту" size="lg" onClose={() => setPanel(null)}>
          <DialogHeader
            title="Слова з тексту"
            subtitle="Встав текст і тапни незнайомі слова — AI заповнить картки."
            onClose={() => setPanel(null)}
          />
          <FromTextPanel ai={ai} words={words} onAdded={addWords} />
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
            <CsvImportPanel words={words} onImported={addWords} />
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function WordRow({ isFirst, word }: { isFirst: boolean; word: WordListItem }) {
  const isPaused = word.status !== "active";

  return (
    <li className={isFirst ? "" : "border-t border-line"}>
      <Link
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-surface-3/50 md:px-5"
        href={`/app/words/${word.id}`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-semibold ${isPaused ? "text-muted" : "text-text"}`} lang="en">
            {word.lemma}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{word.translation || "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isPaused ? <Badge tone="neutral">пауза</Badge> : null}
          {word.maxLapses >= 2 && !isPaused ? <Badge tone="red">складне</Badge> : null}
          <span
            className="hidden w-24 items-center justify-end gap-2 text-xs text-faint sm:flex"
            title={`Прогрес: ${word.progress.label}`}
          >
            {word.progress.label}
            <span className="flex gap-0.5">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-3 w-1 rounded-full ${word.progress.level >= step ? "bg-accent" : "bg-surface-4"}`}
                />
              ))}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}
