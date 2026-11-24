"use client";

import { Activity, AlertCircle, CalendarDays, Check, Flame, Layers, PencilLine, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cardKindLabels } from "@/lib/memora/card-render";
import type { RecentReview, WeakCard } from "@/lib/memora/data/progress";
import { buildHeatmap, HEATMAP_WEEKS, parseDay, recallRate, type ProgressStats } from "@/lib/memora/progress";
import { pluralizeDays } from "@/lib/memora/streak";
import { PageHeader, SectionHeader, ShellPanel } from "./shared-ui";
import type { IconType } from "./types";
import { formatDate, formatPercent, plural, ratingLabels } from "./utils";

export function ProgressView({
  recentReviews,
  stats,
  weakCards,
}: {
  recentReviews: RecentReview[];
  stats: ProgressStats;
  weakCards: WeakCard[];
}) {
  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader title="Прогрес" />

      <div className="grid grid-cols-4 gap-2 md:gap-3">
        <Kpi icon={Flame} label={`${pluralizeDays(stats.streak.streak)} поспіль`} tone="amber" value={stats.streak.streak.toString()} />
        <Kpi icon={Activity} label="повторень за тиждень" value={stats.reviews7d.toString()} />
        <Kpi icon={TrendingUp} label="згадано за 30 днів" value={formatPercent(recallRate(stats))} />
        <Kpi icon={Check} label="закріплених карток" tone="violet" value={stats.stages.mature.toString()} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <ActivityHeatmap stats={stats} />
        <ForecastChart stats={stats} />
      </div>

      <MemoryStages stats={stats} />

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2">
        <WeakCardsPanel weakCards={weakCards} />
        <RecentReviewsPanel reviews={recentReviews} />
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
  icon: IconType;
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
    <div className="min-w-0 rounded-xl border border-line bg-surface-2/70 px-2.5 py-2.5 md:rounded-2xl md:p-4">
      <p className="flex items-center gap-1.5 text-xl font-semibold tracking-tight md:text-[28px]">
        <span className={`hidden size-8 shrink-0 place-items-center rounded-lg md:grid ${toneClass}`}>
          <Icon className="size-4" />
        </span>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted md:mt-1 md:text-sm">{label}</p>
    </div>
  );
}

const heatSteps = ["bg-surface-3", "bg-accent/25", "bg-accent/45", "bg-accent/70", "bg-accent"];
const dayFormat = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat("uk-UA", { weekday: "short", timeZone: "UTC" });

function ActivityHeatmap({ stats }: { stats: ProgressStats }) {
  const { columns, total, activeDays } = buildHeatmap(stats.activity, stats.today);
  const max = Math.max(1, ...columns.flat().map((day) => day.reviews));
  const level = (count: number) => (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)));

  return (
    <ShellPanel className="p-4 md:p-6">
      <SectionHeader
        icon={CalendarDays}
        title="Активність"
        description={`${plural(total, ["повторення", "повторення", "повторень"])} за ${HEATMAP_WEEKS} тижнів · ${plural(activeDays, ["день", "дні", "днів"])} з практикою`}
      />
      <div className="mt-4 flex gap-2 md:mt-5">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] text-[11px] text-muted">
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
          {columns.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
              {week.map((day) => (
                <span
                  key={day.day}
                  className={`aspect-square w-full rounded-[3px] ${day.isFuture ? "bg-transparent" : heatSteps[level(day.reviews)]}`}
                  title={day.isFuture ? undefined : `${dayFormat.format(parseDay(day.day))}: ${day.reviews} повторень`}
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

function ForecastChart({ stats }: { stats: ProgressStats }) {
  const days = stats.forecast;
  const max = Math.max(1, ...days.map((day) => day.cards));
  const total = days.reduce((sum, day) => sum + day.cards, 0);

  return (
    <ShellPanel className="p-4 md:p-6">
      <SectionHeader
        icon={TrendingUp}
        title="Прогноз повторень"
        description={`${plural(total, ["картка повернеться", "картки повернуться", "карток повернеться"])} за 7 днів`}
      />
      <div className="mt-4 flex h-32 items-end gap-2 md:mt-5 md:h-40" role="list">
        {days.map((day, index) => {
          const label = index === 0 ? "сьог." : weekdayFormat.format(parseDay(day.day));
          return (
            <div
              key={day.day}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              role="listitem"
              title={`${index === 0 ? "Сьогодні" : label}: ${day.cards}`}
            >
              <span className="font-mono text-[11px] text-muted opacity-0 transition group-hover:opacity-100 md:opacity-100">
                {day.cards > 0 ? day.cards : ""}
              </span>
              <span
                className={`w-full max-w-10 rounded-t-[4px] transition-colors ${
                  index === 0 ? "bg-accent" : "bg-accent/45 group-hover:bg-accent/70"
                }`}
                style={{ height: `${Math.max(2, (day.cards / max) * 100)}%` }}
              />
              <span className={`text-[11px] ${index === 0 ? "font-semibold text-text-2" : "text-faint"}`}>{label}</span>
            </div>
          );
        })}
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

function MemoryStages({ stats }: { stats: ProgressStats }) {
  const counts = stats.stages;
  const cardTotal = counts.new + counts.learning + counts.young + counts.mature;
  const total = Math.max(1, cardTotal);

  return (
    <ShellPanel className="p-4 md:p-6">
      <SectionHeader
        icon={Layers}
        title="Стадії запам’ятовування"
        description={`${plural(cardTotal, ["картка", "картки", "карток"])} у навчанні · ${plural(stats.words.active, ["слово", "слова", "слів"])}`}
      />
      <div aria-hidden="true" className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
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
              <dd className="text-lg font-semibold leading-6 tracking-tight">{counts[stage.key]}</dd>
              <dd className="text-xs text-faint">{stage.hint}</dd>
            </div>
          </div>
        ))}
      </dl>
    </ShellPanel>
  );
}

function WeakCardsPanel({ weakCards }: { weakCards: WeakCard[] }) {
  return (
    <ShellPanel className="flex flex-col p-4 md:p-6 xl:max-h-[460px]">
      <SectionHeader
        icon={AlertCircle}
        title="Слабкі місця"
        description="Що забувається найчастіше. Часто допомагає кращий приклад."
      />
      <div className="scrollbar-soft mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {weakCards.length === 0 ? (
          <p className="text-sm text-muted">Поки немає — усе згадується добре.</p>
        ) : (
          weakCards.map((card) => (
            <div
              key={`${card.userWordId}-${card.kind}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface-1 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" lang="en">
                  {card.lemma}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {cardKindLabels[card.kind]} · помилок: {card.lapses}
                </p>
              </div>
              <Link
                aria-label={`Редагувати «${card.lemma}»`}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-accent"
                href={`/app/words/${card.userWordId}`}
                title="Редагувати слово"
              >
                <PencilLine className="size-4" />
              </Link>
            </div>
          ))
        )}
      </div>
    </ShellPanel>
  );
}

function RecentReviewsPanel({ reviews }: { reviews: RecentReview[] }) {
  return (
    <ShellPanel className="flex flex-col p-4 md:p-6 xl:max-h-[460px]">
      <SectionHeader icon={Activity} title="Останні відповіді" />
      <div className="scrollbar-soft mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">Пройди першу практику — відповіді з’являться тут.</p>
        ) : (
          <ul className="divide-y divide-line">
            {reviews.map((review) => (
              <li key={review.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`size-2 shrink-0 rounded-full ${review.wasCorrect ? "bg-accent" : "bg-danger"}`}
                  title={ratingLabels[review.rating]}
                />
                <Link className="min-w-0 flex-1 truncate text-sm hover:text-accent" href={`/app/words/${review.userWordId}`} lang="en">
                  {review.lemma}
                  {review.kind ? <span className="text-faint"> · {cardKindLabels[review.kind]}</span> : null}
                </Link>
                <span className="shrink-0 text-xs text-faint">
                  {ratingLabels[review.rating]} · {formatDate(review.reviewedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ShellPanel>
  );
}
