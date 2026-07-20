"use client";

import {
  Activity,
  AlertCircle,
  BookOpenCheck,
  Check,
  Save,
  Sparkles,
} from "lucide-react";
import type { MemoraState, QueueSummary, ReviewLog } from "@/lib/memora/types";
import { Badge, DeckStat, EmptyState, MiniStat, ShellPanel } from "./shared-ui";
import {
  formatDate,
  formatPercent,
  getWeakCards,
  labelReviewRating,
  reviewAccuracy,
  reviewsInLastDays,
} from "./utils";

export function AnalyticsWorkspace({
  onOpenNote,
  state,
  summary,
}: {
  onOpenNote: (noteId: string) => void;
  state: MemoraState;
  summary: QueueSummary;
}) {
  const recentLogs = state.reviewLogs.slice(-100).reverse();

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <ProgressOverviewPanel state={state} summary={summary} />
      <RecentReviewsPanel logs={recentLogs} state={state} />
      <WeakCardsPanel onOpenNote={onOpenNote} state={state} />
      <MaterialProgressPanel state={state} />
    </div>
  );
}

function ProgressOverviewPanel({
  state,
  summary,
}: {
  state: MemoraState;
  summary: QueueSummary;
}) {
  const last7Logs = reviewsInLastDays(state.reviewLogs, 7);
  const last30Logs = reviewsInLastDays(state.reviewLogs, 30);
  const last30Accuracy = reviewAccuracy(last30Logs);
  const activeCards = state.cards.filter((card) => card.status === "active");

  return (
    <ShellPanel className="p-4 md:p-5 xl:min-h-[314px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Навчальна динаміка</h2>
        </div>
        <Sparkles className="size-5 text-[#f2a84a]" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="За 7 днів" value={last7Logs.length.toString()} />
        <MiniStat label="За 30 днів" value={last30Logs.length.toString()} />
        <MiniStat label="Усього" value={state.reviewLogs.length.toString()} />
        <MiniStat label="Якість" value={formatPercent(last30Accuracy)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="У черзі" value={summary.totalDue.toString()} />
        <MiniStat label="Активних карток" value={activeCards.length.toString()} />
        <MiniStat label="Невдалих спроб" value={summary.lapses.toString()} />
        <MiniStat label="Закріплені" value={summary.matureCards.toString()} />
      </div>
    </ShellPanel>
  );
}

function RecentReviewsPanel({
  logs,
  state,
}: {
  logs: ReviewLog[];
  state: MemoraState;
}) {
  const hasLogs = logs.length > 0;

  return (
    <ShellPanel className="flex flex-col p-4 md:p-5 xl:h-[314px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Останні повторення</h2>
        </div>
        <Activity className="size-5 text-[#2dd4bf]" />
      </div>

      <div
        aria-label="Історія останніх повторень"
        className={`mt-4 min-h-0 space-y-3 ${
          hasLogs ? "scrollbar-hidden overflow-y-auto pr-1 xl:flex-1" : ""
        }`}
      >
        {logs.length === 0 ? (
          <div className="rounded-lg border border-[#263140] bg-[#151d28] p-5">
            <EmptyState
              icon={Activity}
              title="Повторень ще немає"
              description="Оцінені картки з'являться тут."
            />
          </div>
        ) : (
          logs.map((log) => {
            const card = state.cards.find((item) => item.id === log.cardId);

            return (
              <div
                key={log.id}
                className="rounded-lg border border-[#263140] bg-[#0d131c] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge tone={log.wasCorrect ? "green" : "violet"}>
                    {labelReviewRating(log.rating)}
                  </Badge>
                  <span className="text-xs text-[#9aa8ba]">
                    {formatDate(log.reviewedAt)}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium">
                  {card?.prompt ?? "Повторена картка"}
                </p>
                <p className="mt-1 text-xs text-[#9aa8ba]">
                  {log.wasCorrect ? "Згадано" : "Потрібно повторити"} /{" "}
                  {Math.round(log.elapsedMs / 1000)} сек
                </p>
              </div>
            );
          })
        )}
      </div>
    </ShellPanel>
  );
}

function WeakCardsPanel({
  onOpenNote,
  state,
}: {
  onOpenNote: (noteId: string) => void;
  state: MemoraState;
}) {
  const weakCards = getWeakCards(state);
  const notesById = new Map(state.notes.map((note) => [note.id, note]));
  const hasWeakCards = weakCards.length > 0;

  return (
    <ShellPanel className="flex flex-col p-4 md:p-5 xl:h-[314px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Слабкі картки</h2>
        </div>
        <AlertCircle className="size-5 text-[#ef6351]" />
      </div>

      <div
        aria-label="Список слабких карток"
        className={`mt-4 min-h-0 space-y-3 ${
          hasWeakCards ? "scrollbar-hidden overflow-y-auto pr-1 xl:flex-1" : ""
        }`}
      >
        {weakCards.length === 0 ? (
          <div className="rounded-lg border border-[#263140] bg-[#151d28] p-5">
            <EmptyState
              icon={Check}
              title="Явних слабких карток немає"
              description="Тут з'являться картки, які часто повертаються після помилок."
            />
          </div>
        ) : (
          weakCards.map((card) => {
            const note = notesById.get(card.noteId);

            return (
              <div
                key={card.id}
                className="rounded-lg border border-[#263140] bg-[#0d131c] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">
                      {card.prompt}
                    </p>
                    {note ? (
                      <p className="mt-1 truncate text-xs text-[#9aa8ba]">
                        {note.title}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={card.module === "english" ? "green" : "violet"}>
                    {card.module === "english" ? "Англ." : "QA"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#9aa8ba]">
                  <span>помилок: {card.schedule.lapses}</span>
                  <span>повторень: {card.schedule.reps}</span>
                  <span>наступний раз: {formatDate(card.schedule.due)}</span>
                </div>
                <button
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
                  onClick={() => onOpenNote(card.noteId)}
                  type="button"
                >
                  <Save className="size-4" />
                  Виправити матеріал
                </button>
              </div>
            );
          })
        )}
      </div>
    </ShellPanel>
  );
}

function MaterialProgressPanel({ state }: { state: MemoraState }) {
  const activeNotes = state.notes.filter((note) => note.status === "active");
  const suspendedNotes = state.notes.filter((note) => note.status === "suspended");
  const activeCards = state.cards.filter((card) => card.status === "active");
  const englishCards = activeCards.filter((card) => card.module === "english");
  const qaCards = activeCards.filter((card) => card.module === "qa");
  const sourceCounts = {
    imported: state.notes.filter((note) => note.source === "imported").length,
    seed: state.notes.filter((note) => note.source === "seed").length,
    user: state.notes.filter((note) => note.source === "user").length,
  };

  return (
    <ShellPanel className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Матеріали</h2>
        </div>
        <BookOpenCheck className="size-5 text-[#2dd4bf]" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="В навчанні" value={activeNotes.length.toString()} />
        <MiniStat label="На паузі" value={suspendedNotes.length.toString()} />
        <MiniStat label="Усього" value={state.notes.length.toString()} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DeckStat
          title="Англійські картки"
          value={englishCards.length}
          tone="green"
        />
        <DeckStat
          title="QA картки"
          value={qaCards.length}
          tone="violet"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Приклади Memora" value={sourceCounts.seed.toString()} />
        <MiniStat label="Додані вручну" value={sourceCounts.user.toString()} />
        <MiniStat label="Імпорт" value={sourceCounts.imported.toString()} />
      </div>
    </ShellPanel>
  );
}
