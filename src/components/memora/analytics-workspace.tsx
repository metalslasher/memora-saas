"use client";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  Check,
  Flame,
  Layers,
  PencilLine,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { buildStreakStats, pluralizeDays } from "@/lib/memora/streak";
import type { MemoraState, QueueSummary, StudyCard } from "@/lib/memora/types";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionHeader,
  ShellPanel,
} from "./shared-ui";
import {
  formatDate,
  formatPercent,
  getWeakCards,
  labelReviewRating,
  plural,
  reviewAccuracy,
  reviewsInLastDays,
} from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 18;

export function AnalyticsWorkspace({
  onOpenNote,
  state,
  summary,
}: {
  onOpenNote: (noteId: string) => void;
  state: MemoraState;
  summary: QueueSummary;
}) {
  const streak = useMemo(() => buildStreakStats(state.reviewLogs), [state.reviewLogs]);
  const last7 = reviewsInLastDays(state.reviewLogs, 7);
  const accuracy30 = reviewAccuracy(reviewsInLastDays(state.reviewLogs, 30));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Прогрес"
        description="Як рухається навчання і що варто підтягнути."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Flame}
          label={pluralizeDays(streak.count)}
          value={streak.count.toString()}
          tone="amber"
        />
        <Kpi icon={Activity} label="повторень за тиждень" value={last7.length.toString()} />
        <Kpi
          icon={TrendingUp}
          label="згадано за 30 днів"
          value={formatPercent(accuracy30)}
        />
        <Kpi
          icon={Check}
          label="закріплених карток"
          value={summary.matureCards.toString()}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <ActivityHeatmap state={state} />
        <ForecastChart state={state} />
      </div>

      <MemoryStages cards={state.cards} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <WeakCardsPanel state={state} onOpenNote={onOpenNote} />
        <RecentReviewsPanel state={state} />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "green",
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  tone?: "green" | "amber" | "violet";
}) {
  const toneClass = {
    green: "bg-accent-soft text-accent",
    amber: "bg-amber-soft text-amber",
    violet: "bg-violet-soft text-violet",
  }[tone];

  return (
    <div className="rounded-2xl border border-line bg-surface-2/70 p-4">
      <span className={`grid size-8 place-items-center rounded-lg ${toneClass}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-2xl font-semibold tracking-tight md:text-[28px]">{value}</p>
      <p className="mt-0.5 text-xs text-muted md:text-sm">{label}</p>
    </div>
  );
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const heatSteps = [
  "bg-surface-3",
  "bg-accent/25",
  "bg-accent/45",
  "bg-accent/70",
  "bg-accent",
];

function ActivityHeatmap({ state }: { state: MemoraState }) {
  const { weeks, total, activeDays } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of state.reviewLogs) {
      const key = localDayKey(new Date(log.reviewedAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const today = startOfDay(new Date());
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - mondayOffset - (HEATMAP_WEEKS - 1) * 7);

    const result: Array<Array<{ date: Date; count: number; isFuture: boolean }>> = [];
    let sum = 0;
    let days = 0;
    for (let week = 0; week < HEATMAP_WEEKS; week += 1) {
      const column = [];
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + week * 7 + day);
        const count = counts.get(localDayKey(date)) ?? 0;
        const isFuture = date > today;
        if (!isFuture) {
          sum += count;
          if (count > 0) days += 1;
        }
        column.push({ date, count, isFuture });
      }
      result.push(column);
    }

    return { weeks: result, total: sum, activeDays: days };
  }, [state.reviewLogs]);

  const max = Math.max(1, ...weeks.flat().map((day) => day.count));
  const dayFormat = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" });

  function level(count: number) {
    if (count === 0) return 0;
    return Math.min(4, Math.ceil((count / max) * 4));
  }

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader
        icon={CalendarDays}
        title="Активність"
        description={`${plural(total, ["повторення", "повторення", "повторень"])} за ${HEATMAP_WEEKS} тижнів · ${plural(activeDays, ["день", "дні", "днів"])} з практикою`}
      />
      <div className="mt-5 flex gap-2">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] text-[10px] text-faint">
          {["Пн", "", "Ср", "", "Пт", "", "Нд"].map((label, index) => (
            <span key={index} className="flex items-center">
              {label}
            </span>
          ))}
        </div>
        <div
          className="grid min-w-0 max-w-[560px] flex-1 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` }}
        >
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
              {week.map((day) => (
                <span
                  key={day.date.toISOString()}
                  className={`aspect-square w-full rounded-[3px] ${
                    day.isFuture ? "bg-transparent" : heatSteps[level(day.count)]
                  }`}
                  title={
                    day.isFuture
                      ? undefined
                      : `${dayFormat.format(day.date)}: ${day.count} повторень`
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        менше
        {heatSteps.map((step) => (
          <span key={step} className={`size-[10px] rounded-[3px] ${step}`} />
        ))}
        більше
      </div>
    </ShellPanel>
  );
}

function ForecastChart({ state }: { state: MemoraState }) {
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const buckets = Array.from({ length: 7 }, (_, index) => ({
      date: new Date(today.getTime() + index * DAY_MS),
      count: 0,
    }));

    for (const card of state.cards) {
      if (card.status !== "active" || card.schedule.reps === 0) continue;
      const due = startOfDay(new Date(card.schedule.due)).getTime();
      const index = Math.max(0, Math.round((due - today.getTime()) / DAY_MS));
      if (index < 7) buckets[index].count += 1;
    }

    return buckets;
  }, [state.cards]);

  const max = Math.max(1, ...days.map((day) => day.count));
  const weekday = new Intl.DateTimeFormat("uk-UA", { weekday: "short" });
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader
        icon={TrendingUp}
        title="Прогноз повторень"
        description={`${plural(total, ["картка повернеться", "картки повернуться", "карток повернеться"])} за 7 днів`}
      />
      <div className="mt-5 flex h-40 items-end gap-2" role="list">
        {days.map((day, index) => (
          <div
            key={index}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            role="listitem"
            title={`${index === 0 ? "Сьогодні" : weekday.format(day.date)}: ${day.count}`}
          >
            <span className="font-mono text-[11px] text-muted opacity-0 transition group-hover:opacity-100 md:opacity-100">
              {day.count > 0 ? day.count : ""}
            </span>
            <span
              className={`w-full max-w-10 rounded-t-[4px] transition-colors ${
                index === 0 ? "bg-accent" : "bg-accent/45 group-hover:bg-accent/70"
              }`}
              style={{ height: `${Math.max(2, (day.count / max) * 100)}%` }}
            />
            <span
              className={`text-[11px] ${index === 0 ? "font-semibold text-text-2" : "text-faint"}`}
            >
              {index === 0 ? "сьог." : weekday.format(day.date)}
            </span>
          </div>
        ))}
      </div>
    </ShellPanel>
  );
}

const stageMeta = [
  { key: "new", label: "Нові", hint: "ще не вивчались", className: "bg-surface-4" },
  { key: "learning", label: "Вчаться", hint: "перші повторення", className: "bg-accent/30" },
  { key: "young", label: "Молоді", hint: "інтервал до 3 тижнів", className: "bg-accent/60" },
  { key: "mature", label: "Закріплені", hint: "інтервал від 3 тижнів", className: "bg-accent" },
] as const;

function stageOf(card: StudyCard) {
  if (card.schedule.reps === 0) return "new";
  if (card.schedule.state === "Learning" || card.schedule.state === "Relearning") {
    return "learning";
  }
  return card.schedule.scheduled_days >= 21 ? "mature" : "young";
}

function MemoryStages({ cards }: { cards: StudyCard[] }) {
  const activeCards = cards.filter((card) => card.status === "active");
  const counts = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const card of activeCards) counts[stageOf(card)] += 1;
  const total = Math.max(1, activeCards.length);
  const byModule = {
    english: activeCards.filter((card) => card.module === "english").length,
    qa: activeCards.filter((card) => card.module === "qa").length,
  };

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader
        icon={Layers}
        title="Стадії запам’ятовування"
        description={`${plural(activeCards.length, ["картка", "картки", "карток"])} у навчанні · англійська ${byModule.english}, QA ${byModule.qa}`}
      />
      <div
        aria-hidden="true"
        className="mt-5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
      >
        {stageMeta.map((stage) =>
          counts[stage.key] > 0 ? (
            <span
              key={stage.key}
              className={`h-full ${stage.className}`}
              style={{ width: `${(counts[stage.key] / total) * 100}%` }}
              title={`${stage.label}: ${counts[stage.key]}`}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stageMeta.map((stage) => (
          <div key={stage.key} className="flex items-start gap-2.5">
            <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${stage.className}`} />
            <div>
              <dt className="text-sm text-text-2">{stage.label}</dt>
              <dd className="text-lg font-semibold leading-6 tracking-tight">
                {counts[stage.key]}
              </dd>
              <dd className="text-xs text-faint">{stage.hint}</dd>
            </div>
          </div>
        ))}
      </dl>
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

  return (
    <ShellPanel className="flex flex-col p-5 md:p-6 xl:max-h-[460px]">
      <SectionHeader
        icon={AlertCircle}
        title="Слабкі місця"
        description="Картки, на яких ти помиляєшся найчастіше. Часто допомагає кращий приклад."
      />
      <div className="scrollbar-soft mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {weakCards.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={Check}
              title="Слабких місць немає"
              description="Тут з’являться картки, які часто повертаються після помилок."
            />
          </div>
        ) : (
          weakCards.map((card) => (
            <div
              key={card.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface-1 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{card.prompt}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge tone={card.module === "english" ? "green" : "violet"}>
                    {card.module === "english" ? "Англ." : "QA"}
                  </Badge>
                  помилок: {card.schedule.lapses}
                </p>
              </div>
              <button
                aria-label="Редагувати матеріал"
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-accent"
                onClick={() => onOpenNote(card.noteId)}
                title="Редагувати матеріал"
                type="button"
              >
                <PencilLine className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </ShellPanel>
  );
}

function RecentReviewsPanel({ state }: { state: MemoraState }) {
  const logs = state.reviewLogs.slice(-60).reverse();
  const cardsById = new Map(state.cards.map((card) => [card.id, card]));

  return (
    <ShellPanel className="flex flex-col p-5 md:p-6 xl:max-h-[460px]">
      <SectionHeader icon={Activity} title="Останні відповіді" />
      <div className="scrollbar-soft mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={Activity}
              title="Ще немає відповідей"
              description="Пройди першу практику — історія з’явиться тут."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    log.wasCorrect ? "bg-accent" : "bg-danger"
                  }`}
                  title={labelReviewRating(log.rating)}
                />
                <p className="min-w-0 flex-1 truncate text-sm">
                  {cardsById.get(log.cardId)?.prompt ?? "Видалена картка"}
                </p>
                <span className="shrink-0 text-xs text-faint">
                  {labelReviewRating(log.rating)} · {formatDate(log.reviewedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ShellPanel>
  );
}
