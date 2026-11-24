"use client";

import { ArrowRight, Check, Clock3, Flame, Gauge, Plus, Sparkles, Target, Timer, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { estimateMinutes, sessionOptions } from "@/lib/memora/pace";
import { isNewWordCard } from "@/lib/memora/queue";
import { pluralizeDays } from "@/lib/memora/streak";
import type { PracticeCard, PracticeSummary } from "@/lib/memora/types";
import { useShell } from "../app-shell";
import { Button, buttonClass, SegmentedControl } from "../shared-ui";
import { useSpeechSupported } from "../speech";
import { useFreshSnapshot } from "../use-fresh-snapshot";
import { plural } from "../utils";
import { StudyCardView } from "./study-card";
import { usePracticeSession, type PracticeSession } from "./use-practice-session";

export function PracticeWorkspace({
  initialCards,
  snapshot,
  summary,
  offerTest = false,
}: {
  initialCards: PracticeCard[];
  snapshot: string;
  summary: PracticeSummary;
  /** Learner without onboarding (has own words): a soft offer to take the test. */
  offerTest?: boolean;
}) {
  useFreshSnapshot(snapshot);
  const canPlayAudio = useSpeechSupported();
  const practice = usePracticeSession(initialCards, summary, { canPlayAudio });
  const { activeCard, session } = practice;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PracticeHeader practice={practice} />
      {offerTest ? <TestOffer /> : null}
      <div className="mt-3 md:mt-5">
        {activeCard ? (
          <>
            <SessionProgress practice={practice} />
            <StudyCardView key={activeCard.id} card={activeCard} practice={practice} />
          </>
        ) : session.reviewed > 0 || practice.isTimeUp ? (
          <SessionComplete practice={practice} />
        ) : (
          <NothingDue practice={practice} />
        )}
      </div>
    </div>
  );
}

const testOfferKey = "memora.test-offer-dismissed";

function TestOffer() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Read after mount: localStorage is not available on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(window.localStorage.getItem(testOfferKey) !== "1");
  }, []);
  if (!visible) return null;

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft/60 py-2 pl-3 pr-1 text-sm">
      <Gauge className="size-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 leading-5 text-text-2">
        Тест на 5 хвилин — і Memora щодня сама додаватиме слова твого рівня.
      </p>
      <Link className={buttonClass("primary", "sm", "shrink-0")} href="/app/onboarding">
        Пройти
      </Link>
      <button
        aria-label="Сховати пропозицію"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-text"
        onClick={() => {
          window.localStorage.setItem(testOfferKey, "1");
          setVisible(false);
        }}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 5) return "Доброї ночі";
  if (hour < 12) return "Доброго ранку";
  if (hour < 18) return "Доброго дня";
  return "Доброго вечора";
}

function PracticeHeader({ practice }: { practice: PracticeSession }) {
  const fresh = practice.queue.filter(isNewWordCard).length;
  const reviews = practice.queue.length - fresh;
  const parts: string[] = [];
  if (reviews > 0) parts.push(`${reviews} на повторення`);
  if (fresh > 0) parts.push(plural(fresh, ["нове слово", "нові слова", "нових слів"]));
  const options = sessionOptions(practice.summary.dailyMinutes);

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight md:text-[28px]" suppressHydrationWarning>
          {greeting()}
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-text-2">
          {parts.length > 0 ? (
            <>
              <span>{parts.join(" · ")}</span>
              <span className="inline-flex items-center gap-1 text-muted">
                <Clock3 className="size-3.5" />≈ {estimateMinutes(practice.queue.length)} хв
              </span>
            </>
          ) : (
            <span className="text-muted">На сьогодні черга порожня</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-faint">Сесія</span>
        <SegmentedControl
          ariaLabel="Довжина сесії"
          className="[&_button]:h-8 [&_button]:px-2.5"
          options={options.map((minutes) => ({ value: String(minutes), label: `${minutes} хв` }))}
          value={String(practice.sessionMinutes)}
          onChange={(value) => practice.setSessionMinutes(Number(value))}
        />
      </div>
    </div>
  );
}

function SessionProgress({ practice }: { practice: PracticeSession }) {
  const { session, sessionMinutes } = practice;
  const limitMs = sessionMinutes * 60_000;
  const percent = Math.min(100, Math.round((session.activeMs / limitMs) * 100));
  const usedMinutes = Math.floor(session.activeMs / 60_000);

  return (
    <div className="mb-2 flex items-center gap-3">
      <Timer className="size-4 shrink-0 text-faint" />
      <div
        aria-label={`Минуло ${usedMinutes} з ${sessionMinutes} хв`}
        aria-valuemax={sessionMinutes}
        aria-valuemin={0}
        aria-valuenow={usedMinutes}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-violet transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted" data-testid="session-count" title="Пройдено карток · залишилось">
        {session.reviewed} · {practice.queue.length}
      </span>
      <button
        aria-label="Скасувати останню оцінку"
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-text disabled:pointer-events-none disabled:opacity-30"
        disabled={!practice.canUndo}
        onClick={practice.undo}
        title="Скасувати останню оцінку (Z)"
        type="button"
      >
        <Undo2 className="size-4" />
      </button>
    </div>
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} с`;
  return `${minutes} хв ${seconds.toString().padStart(2, "0")} с`;
}

function formatNextDue(date: Date | null, now = new Date()) {
  if (!date) return null;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(date);

  if (date.toDateString() === now.toDateString()) return `сьогодні о ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `завтра о ${time}`;
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(date);
}

function SessionComplete({ practice }: { practice: PracticeSession }) {
  const { streak } = useShell();
  const [endedAt] = useState(() => Date.now());
  const { session } = practice;
  const accuracy = session.reviewed > 0 ? Math.round((session.correct / session.reviewed) * 100) : 0;
  const nextLabel = formatNextDue(practice.nextDue);
  const leftInQueue = practice.isTimeUp ? practice.queue.length : 0;

  return (
    <div className="animate-card overflow-hidden rounded-3xl border border-line-strong bg-surface-2 text-center">
      <div className="glow-accent px-6 pb-5 pt-8 md:pt-10">
        <div className="animate-pop mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_12px_40px_-10px_rgba(62,224,191,0.8)]">
          <Check className="size-7" strokeWidth={2.5} />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          {practice.isTimeUp ? "Час сесії вийшов" : "Сесію завершено"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          {leftInQueue > 0
            ? `У черзі ще ${leftInQueue}. Можна продовжити або повернутися пізніше — нічого не згорить.`
            : nextLabel
              ? `Наступні картки чекатимуть ${nextLabel}. А пам’ять тим часом закріплює результат.`
              : "Пам’ять тим часом закріплює результат."}
        </p>
      </div>

      <div className="grid grid-cols-3 border-y border-line">
        <SummaryStat label="карток" value={session.reviewed.toString()} />
        <SummaryStat label="згадано" value={`${accuracy}%`} />
        <SummaryStat label="час" value={formatDuration(endedAt - session.startedAt)} />
      </div>

      <div className="flex flex-col items-center gap-4 px-6 py-5">
        <p className="inline-flex items-center gap-2 text-sm text-text-2">
          <Flame className="size-4 text-amber" />
          Серія: {streak.streak} {pluralizeDays(streak.streak)}
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {leftInQueue > 0 ? (
            <Button icon={Timer} variant="primary" onClick={() => practice.extendSession(5)}>
              Ще 5 хвилин
            </Button>
          ) : null}
          {practice.heldBackNew > 0 ? (
            <Button
              icon={Sparkles}
              isLoading={practice.isLoadingMore}
              variant={leftInQueue > 0 ? "secondary" : "primary"}
              onClick={() => practice.learnMore(5)}
            >
              Ще {Math.min(5, practice.heldBackNew)} нових
            </Button>
          ) : null}
          <Link className={buttonClass("secondary", "md")} href="/app/words">
            <Plus className="size-4" />
            Додати слова
          </Link>
          <Link className={buttonClass("ghost", "md")} href="/app/progress">
            <ArrowRight className="size-4" />
            Мій прогрес
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-4 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-line">
      <p className="text-xl font-semibold tracking-tight md:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function NothingDue({ practice }: { practice: PracticeSession }) {
  if (practice.summary.activeCards === 0) {
    return (
      <div className="animate-card rounded-3xl border border-line-strong bg-surface-2 px-6 py-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Target className="size-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Почни з першого слова</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          Додай слово чи фразу — Memora сама вирішить, коли і як його тренувати.
        </p>
        <div className="mt-6 flex justify-center">
          <Link className={buttonClass("primary", "md")} href="/app/words">
            <Plus className="size-4" />
            Додати слово
          </Link>
        </div>
      </div>
    );
  }

  const nextLabel = formatNextDue(practice.nextDue);

  return (
    <div className="animate-card rounded-3xl border border-line-strong bg-surface-2 px-6 py-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Check className="size-7" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Усе повторено</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
        {nextLabel
          ? `Наступне повторення — ${nextLabel}. Повертайся, коли настане час.`
          : "Нових повторень поки немає. Додай слова, щоб продовжити."}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        {practice.heldBackNew > 0 ? (
          <Button
            icon={Sparkles}
            isLoading={practice.isLoadingMore}
            variant="primary"
            onClick={() => practice.learnMore(5)}
          >
            Вивчити ще {Math.min(5, practice.heldBackNew)} нових
          </Button>
        ) : null}
        <Link className={buttonClass("ghost", "md")} href="/app/words">
          <Plus className="size-4" />
          Додати слова
        </Link>
      </div>
    </div>
  );
}
