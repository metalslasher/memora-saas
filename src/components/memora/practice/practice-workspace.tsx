"use client";

import { ArrowRight, Check, Clock3, Flame, PauseCircle, PencilLine, Plus, Sparkles, Target, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkAnswer, type AnswerCheck } from "@/lib/memora/answer-check";
import { cardKindLabels, renderCard, type RenderedCard } from "@/lib/memora/card-render";
import { estimateMinutes } from "@/lib/memora/queue";
import { formatInterval, previewNextDue } from "@/lib/memora/scheduler";
import { pluralizeDays } from "@/lib/memora/streak";
import type { LearningSettings, PracticeCard, PracticeSummary, ReviewRating } from "@/lib/memora/types";
import { useShell } from "../app-shell";
import { Badge, Button, buttonClass, Kbd } from "../shared-ui";
import { SpeakButton } from "../speech";
import { useFreshSnapshot } from "../use-fresh-snapshot";
import { usePracticeSession, type PracticeSession } from "./use-practice-session";

type ReviewButtons = LearningSettings["reviewButtons"];

export function PracticeWorkspace({
  initialCards,
  reviewButtons,
  snapshot,
  summary,
}: {
  initialCards: PracticeCard[];
  reviewButtons: ReviewButtons;
  snapshot: string;
  summary: PracticeSummary;
}) {
  useFreshSnapshot(snapshot);
  const practice = usePracticeSession(initialCards, summary);
  const { activeCard, session } = practice;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PracticeHeader compact={session.reviewed > 0} practice={practice} />
      <div className="mt-5 md:mt-6">
        {activeCard ? (
          <>
            <SessionProgress practice={practice} />
            <StudyCardView card={activeCard} practice={practice} reviewButtons={reviewButtons} />
          </>
        ) : session.reviewed > 0 ? (
          <SessionComplete practice={practice} />
        ) : (
          <NothingDue practice={practice} />
        )}
      </div>
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

function PracticeHeader({ compact, practice }: { compact: boolean; practice: PracticeSession }) {
  const reviews = practice.queue.filter((card) => card.schedule.reps > 0).length;
  const fresh = practice.queue.length - reviews;
  const parts: string[] = [];
  if (reviews > 0) parts.push(`${reviews} на повторення`);
  if (fresh > 0) parts.push(`${fresh} нових`);

  return (
    <div className={compact ? "hidden sm:block" : ""}>
      <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]" suppressHydrationWarning>
        {greeting()}
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        {parts.length > 0 ? (
          <>
            <span>{parts.join(" · ")}</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />≈ {estimateMinutes(practice.queue.length)} хв
            </span>
          </>
        ) : (
          <span>На сьогодні черга порожня</span>
        )}
      </p>
    </div>
  );
}

function SessionProgress({ practice }: { practice: PracticeSession }) {
  const done = practice.session.reviewed;
  const total = Math.max(1, done + practice.queue.length);
  const percent = Math.round((done / total) * 100);

  return (
    <div className="mb-3 flex items-center gap-3">
      <div
        aria-label={`Пройдено ${done} з ${total}`}
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={done}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-violet transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted">
        {done}/{total}
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

const gradeMeta: Record<ReviewRating, { label: string; key: string; tone: string; solid: string }> = {
  again: {
    label: "Не згадав",
    key: "1",
    tone: "border-danger/25 bg-danger-soft text-[#ffb4aa] hover:border-danger/60",
    solid: "border-danger bg-danger text-white",
  },
  hard: {
    label: "Важко",
    key: "2",
    tone: "border-amber/25 bg-amber-soft text-amber hover:border-amber/60",
    solid: "border-amber bg-amber text-accent-ink",
  },
  good: {
    label: "Згадав",
    key: "3",
    tone: "border-accent/25 bg-accent-soft text-accent hover:border-accent/60",
    solid: "border-accent bg-accent text-accent-ink",
  },
  easy: {
    label: "Легко",
    key: "4",
    tone: "border-violet/25 bg-violet-soft text-violet hover:border-violet/60",
    solid: "border-violet bg-violet text-accent-ink",
  },
};

function cardStageBadge(card: PracticeCard) {
  if (card.schedule.reps === 0) return { label: "Нова", tone: "violet" as const };
  if (card.schedule.lapses >= 3) return { label: "Складна", tone: "red" as const };
  if (card.schedule.state === "Relearning" || card.schedule.state === "Learning") {
    return { label: "Закріплення", tone: "amber" as const };
  }
  return { label: "Повторення", tone: "neutral" as const };
}

function StudyCardView({
  card,
  practice,
  reviewButtons,
}: {
  card: PracticeCard;
  practice: PracticeSession;
  reviewButtons: ReviewButtons;
}) {
  const { canUndo, isRevealed, responseText, grade, reveal, undo, pause, setResponseText } = practice;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [now] = useState(() => new Date());
  const view = useMemo(() => renderCard(card.kind, card.lemma, card.content), [card]);
  const ratings: ReviewRating[] = reviewButtons === "advanced" ? ["again", "hard", "good", "easy"] : ["again", "good"];
  const check: AnswerCheck | null = useMemo(
    () => (isRevealed ? checkAnswer(responseText, view.answer) : null),
    [isRevealed, responseText, view.answer],
  );
  const intervals = useMemo(() => {
    try {
      const preview = previewNextDue(card.schedule, now);
      return Object.fromEntries(
        (Object.keys(preview) as ReviewRating[]).map((rating) => [rating, formatInterval(now, preview[rating])]),
      ) as Record<ReviewRating, string>;
    } catch {
      return null;
    }
  }, [card.schedule, now]);
  const suggested = check?.suggestedRating ?? null;
  const stage = cardStageBadge(card);
  const isShortCue = view.cue.length <= 90;

  // Focus the answer field on devices with a real keyboard.
  useEffect(() => {
    if (isRevealed) return;
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [card.id, isRevealed]);

  // Keyboard shortcuts: Enter/Space reveal, 1-4 grade, Z undo.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";
      const isUndoKey = event.key === "z" || event.key === "я";

      if (!isRevealed) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          reveal();
        } else if (event.key === " " && !isTyping) {
          event.preventDefault();
          reveal();
        } else if (isUndoKey && !isTyping && canUndo) {
          undo();
        }
        return;
      }

      const byKey: Record<string, ReviewRating | undefined> =
        reviewButtons === "advanced"
          ? { "1": "again", "2": "hard", "3": "good", "4": "easy" }
          : { "1": "again", "2": "good", "3": "good" };
      const rating = byKey[event.key];
      if (rating) {
        event.preventDefault();
        grade(rating);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        grade(suggested ?? "good");
      } else if (isUndoKey && canUndo) {
        undo();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canUndo, grade, isRevealed, reveal, reviewButtons, suggested, undo]);

  return (
    <div>
      <article
        key={card.id}
        className="animate-card relative overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-b from-surface-3/80 to-surface-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
        />

        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge tone={stage.tone}>{stage.label}</Badge>
            <span className="text-xs text-faint">{cardKindLabels[card.kind]}</span>
          </div>
          <div className="flex shrink-0 items-center">
            <Link
              aria-label="Редагувати слово"
              className="grid size-9 place-items-center rounded-xl text-faint transition hover:bg-surface-4 hover:text-text"
              href={`/app/words/${card.userWordId}`}
              title="Редагувати слово"
            >
              <PencilLine className="size-4" />
            </Link>
            <button
              aria-label="Поставити картку на паузу"
              className="grid size-9 place-items-center rounded-xl text-faint transition hover:bg-surface-4 hover:text-text"
              onClick={() => pause(card.id)}
              title="Пауза: картка зникне з черги"
              type="button"
            >
              <PauseCircle className="size-4" />
            </button>
          </div>
        </div>

        <div className={`px-5 pb-6 pt-5 md:px-10 md:pb-8 md:pt-6 ${isShortCue ? "text-center" : ""}`}>
          <p className="text-sm text-muted">{view.instruction}</p>
          <h2
            className={`mt-2 text-balance font-semibold leading-snug tracking-tight ${
              isShortCue ? "text-2xl md:text-[32px] md:leading-tight" : "text-xl md:text-2xl"
            }`}
            lang={view.cueLanguage}
          >
            {view.cue}
          </h2>
          {view.cueLanguage === "en" ? (
            <div className={`mt-2 ${isShortCue ? "flex justify-center" : ""}`}>
              <SpeakButton text={view.cue} />
            </div>
          ) : null}
        </div>

        {!isRevealed ? (
          <div className="border-t border-line/70 bg-surface-1/40 p-4 md:p-6">
            <label className="sr-only" htmlFor="practice-answer">
              Твоя відповідь
            </label>
            <textarea
              ref={inputRef}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="block max-h-40 min-h-[52px] w-full resize-none rounded-2xl border border-line-strong bg-surface-1 px-4 py-3.5 text-base leading-6 text-text outline-none transition [field-sizing:content] placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/15"
              enterKeyHint="done"
              id="practice-answer"
              lang={view.answerLanguage}
              placeholder="Впиши відповідь або просто пригадай"
              rows={1}
              spellCheck={false}
              value={responseText}
              onChange={(event) => setResponseText(event.currentTarget.value)}
            />
            <Button className="mt-3 w-full" size="lg" variant="primary" onClick={reveal}>
              {responseText.trim() ? "Перевірити" : "Показати відповідь"}
              <Kbd>Enter</Kbd>
            </Button>
          </div>
        ) : (
          <RevealedAnswer check={check} responseText={responseText} view={view} />
        )}
      </article>

      {isRevealed ? (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-1 mt-3 rounded-3xl bg-ink/80 p-1 backdrop-blur-md lg:bottom-4">
          <div className={`grid gap-2 ${ratings.length === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
            {ratings.map((rating) => {
              const meta = gradeMeta[rating];
              const key = reviewButtons === "advanced" ? meta.key : rating === "again" ? "1" : "2";

              return (
                <button
                  key={rating}
                  className={`flex min-h-[60px] flex-col items-center justify-center rounded-2xl border px-1 py-2 transition active:scale-[0.97] ${
                    suggested === rating ? meta.solid : meta.tone
                  }`}
                  onClick={() => grade(rating)}
                  type="button"
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {meta.label}
                    <Kbd>{key}</Kbd>
                  </span>
                  {intervals ? (
                    <span className="mt-0.5 font-mono text-[11px] opacity-75">{intervals[rating]}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RevealedAnswer({
  check,
  responseText,
  view,
}: {
  check: AnswerCheck | null;
  responseText: string;
  view: RenderedCard;
}) {
  const typed = responseText.trim();

  return (
    <div className="animate-reveal border-t border-line/70 bg-surface-1/40 px-5 py-5 md:px-10 md:py-7">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">Відповідь</p>
      <div className="mt-2 flex items-start gap-2">
        <p
          className={`min-w-0 flex-1 font-semibold leading-snug tracking-tight text-accent-strong ${
            view.answer.length > 60 ? "text-lg md:text-xl" : "text-2xl md:text-[28px]"
          }`}
          lang={view.answerLanguage}
        >
          {view.answer}
        </p>
        {view.answerLanguage === "en" ? <SpeakButton text={view.answer} /> : null}
      </div>
      {view.partOfSpeech ? <p className="mt-1 text-xs text-faint">{view.partOfSpeech}</p> : null}

      {typed && check ? <AnswerComparison check={check} typed={typed} /> : null}

      {view.example ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface-2/70 px-4 py-3">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[15px] italic leading-6 text-text-2" lang="en">
              {view.example.en}
            </p>
            <SpeakButton className="-my-1 -mr-2" label="Прослухати приклад" text={view.example.en} />
          </div>
          {view.example.uk ? <p className="mt-1 text-sm leading-5 text-muted">{view.example.uk}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function AnswerComparison({ check, typed }: { check: AnswerCheck; typed: string }) {
  const verdict = {
    exact: { label: "Точно", className: "bg-accent-soft text-accent" },
    close: { label: "Майже — є описка", className: "bg-amber-soft text-amber" },
    different: { label: "Не збігається", className: "bg-danger-soft text-danger" },
    self: { label: "Звір за змістом", className: "bg-surface-4 text-text-2" },
    empty: { label: "", className: "" },
  }[check.verdict];

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface-2/70 px-4 py-3">
      <span className="text-xs text-faint">Твоя відповідь</span>
      <span className="min-w-0 flex-1 text-[15px] text-text">{typed}</span>
      {verdict.label ? (
        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${verdict.className}`}>
          {check.verdict === "exact" ? <Check className="size-3.5" /> : null}
          {verdict.label}
        </span>
      ) : null}
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

  return (
    <div className="animate-card overflow-hidden rounded-3xl border border-line-strong bg-surface-2 text-center">
      <div className="glow-accent px-6 pb-6 pt-10 md:pt-12">
        <div className="animate-pop mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_12px_40px_-10px_rgba(62,224,191,0.8)]">
          <Check className="size-8" strokeWidth={2.5} />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">Сесію завершено</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          {nextLabel
            ? `Наступні картки чекатимуть ${nextLabel}. А пам’ять тим часом закріплює результат.`
            : "Пам’ять тим часом закріплює результат."}
        </p>
      </div>

      <div className="grid grid-cols-3 border-y border-line">
        <SummaryStat label="карток" value={session.reviewed.toString()} />
        <SummaryStat label="згадано" value={`${accuracy}%`} />
        <SummaryStat label="час" value={formatDuration(endedAt - session.startedAt)} />
      </div>

      <div className="flex flex-col items-center gap-4 px-6 py-6">
        <p className="inline-flex items-center gap-2 text-sm text-text-2">
          <Flame className="size-4 text-amber" />
          Серія: {streak.streak} {pluralizeDays(streak.streak)}
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {practice.heldBackNew > 0 ? (
            <Button
              icon={Sparkles}
              isLoading={practice.isLoadingMore}
              variant="primary"
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
    <div className="px-2 py-5 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-line">
      <p className="text-xl font-semibold tracking-tight md:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function NothingDue({ practice }: { practice: PracticeSession }) {
  if (practice.summary.activeCards === 0) {
    return (
      <div className="animate-card rounded-3xl border border-line-strong bg-surface-2 px-6 py-12 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Target className="size-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Почни з першого слова</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          Додай слово чи фразу — Memora зробить із нього картки й підкаже, коли їх повторити.
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
    <div className="animate-card rounded-3xl border border-line-strong bg-surface-2 px-6 py-12 text-center">
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
