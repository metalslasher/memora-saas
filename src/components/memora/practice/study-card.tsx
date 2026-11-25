"use client";

import { AlertTriangle, ArrowRight, Check, Headphones, PauseCircle, PencilLine, RotateCcw, SkipForward } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkAnswer, type AnswerCheck, type DiffPart } from "@/lib/memora/answer-check";
import { autoGrade, ratingLabels } from "@/lib/memora/auto-grade";
import { cardKindLabels, renderCard, type RenderedCard } from "@/lib/memora/card-render";
import { formatInterval, previewNextDue } from "@/lib/memora/scheduler";
import type { PracticeCard, ReviewRating } from "@/lib/memora/types";
import { Badge, Button, Kbd } from "../shared-ui";
import { playEnglish, prefetchEnglish, SpeakButton } from "../speech";
import type { PracticeSession } from "./use-practice-session";

/** Failures after which a card counts as a leech and gets the fix-it panel. */
export const LEECH_LAPSES = 4;

const ratingOrder: ReviewRating[] = ["again", "hard", "good", "easy"];

const ratingTone: Record<ReviewRating, { soft: string; solid: string }> = {
  again: {
    soft: "border-danger/25 bg-danger-soft text-[#ffb4aa] hover:border-danger/60",
    solid: "border-danger bg-danger text-white",
  },
  hard: {
    soft: "border-amber/25 bg-amber-soft text-amber hover:border-amber/60",
    solid: "border-amber bg-amber text-accent-ink",
  },
  good: {
    soft: "border-accent/25 bg-accent-soft text-accent hover:border-accent/60",
    solid: "border-accent bg-accent text-accent-ink",
  },
  easy: {
    soft: "border-violet/25 bg-violet-soft text-violet hover:border-violet/60",
    solid: "border-violet bg-violet text-accent-ink",
  },
};

const verdictMeta: Record<AnswerCheck["verdict"], { label: string; className: string }> = {
  exact: { label: "Правильно", className: "bg-accent-soft text-accent" },
  form: { label: "Слово те, форма інша", className: "bg-amber-soft text-amber" },
  synonym: { label: "Синонім — а вчимо інше слово", className: "bg-amber-soft text-amber" },
  close: { label: "Майже — є описка", className: "bg-amber-soft text-amber" },
  different: { label: "Неправильно", className: "bg-danger-soft text-danger" },
  self: { label: "Перевір себе", className: "bg-surface-4 text-text-2" },
  empty: { label: "", className: "" },
};

export const cardShellClass =
  "animate-card relative flex flex-col overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-b from-surface-3/80 to-surface-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] max-lg:min-h-[calc(100dvh-17rem)]";

export function cardStageBadge(card: PracticeCard) {
  if (card.schedule.reps === 0) {
    if (card.kind === "recognition") return { label: "Нове слово", tone: "violet" as const };
    // A program word the level test credited as known starts right with recall.
    if (card.wordReviewedAt === null) return { label: "Знайоме слово", tone: "violet" as const };
    return { label: "Нова вправа", tone: "violet" as const };
  }
  if (card.schedule.lapses >= LEECH_LAPSES) return { label: "Складне", tone: "red" as const };
  if (card.schedule.state === "Relearning" || card.schedule.state === "Learning") {
    return { label: "Закріплення", tone: "amber" as const };
  }
  return { label: "Повторення", tone: "neutral" as const };
}

/** "1 д", "4 д"… — the next interval for each rating, for the rating buttons. */
export function ratingIntervals(card: PracticeCard, now: Date) {
  try {
    const preview = previewNextDue(card.id, card.schedule, now);
    return Object.fromEntries(
      ratingOrder.map((rating) => [rating, formatInterval(now, preview[rating])]),
    ) as Record<ReviewRating, string>;
  } catch {
    return null;
  }
}

export function StudyCardView({ card, practice }: { card: PracticeCard; practice: PracticeSession }) {
  const { canUndo, isRevealed, responseText, revealedAfterMs, grade, reveal, undo, pause, skip, setResponseText } =
    practice;
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());
  const [showOverride, setShowOverride] = useState(false);
  const view = useMemo(() => renderCard(card.kind, card.lemma, card.content), [card]);
  const typed = responseText.trim();
  const check = useMemo(
    () => (isRevealed && typed ? checkAnswer(typed, view.check) : null),
    [isRevealed, typed, view.check],
  );
  const isSelfRated = view.selfGraded || !check || check.verdict === "self";
  const autoRating =
    !isSelfRated && check
      ? autoGrade({ verdict: check.verdict, elapsedMs: revealedAfterMs ?? 0, answer: view.answer, state: card.schedule.state })
      : null;
  // Self-rated: a typed exact match still hints "Згадав".
  const suggested: ReviewRating | null = autoRating ?? (check?.verdict === "exact" ? "good" : null);
  const intervals = useMemo(() => ratingIntervals(card, now), [card, now]);
  const willFail = (autoRating ?? suggested) === "again" || check?.verdict === "different";
  const isLeech = card.schedule.lapses >= LEECH_LAPSES || (card.schedule.lapses === LEECH_LAPSES - 1 && willFail);
  const isShortCue = view.cue.length <= 90;
  const isListening = view.kind === "listening";

  // Focus the answer field on devices with a real keyboard.
  useEffect(() => {
    if (isRevealed) return;
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [card.id, isRevealed]);

  // Prepare the word's natural-voice clip so the speaker button plays at once.
  useEffect(() => {
    prefetchEnglish(card.lemma);
  }, [card.lemma]);

  // Listening: dictate the word as soon as the card appears.
  useEffect(() => {
    if (view.kind === "listening" && view.audio) void playEnglish(view.audio, { rate: 0.85 });
  }, [card.id, view.kind, view.audio]);

  // Keep the "Далі" button on screen after checking (phones).
  useEffect(() => {
    if (isRevealed) actionsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isRevealed]);

  // Keyboard: Enter checks / goes on, 1–4 rate, Z undoes.
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

      const byKey: Record<string, ReviewRating | undefined> = isSelfRated
        ? { "1": "again", "2": "good" }
        : { "1": "again", "2": "hard", "3": "good", "4": "easy" };
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
  }, [canUndo, grade, isRevealed, isSelfRated, reveal, suggested, undo]);

  /** Rates the card first, so it does not come back, then opens the word. */
  function fixWord(focus: "translation" | "example") {
    grade(suggested ?? "again");
    router.push(`/app/words/${card.userWordId}?edit=${focus}`);
  }

  return (
    <article
      key={card.id}
      className={cardShellClass}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />

      <CardTopBar card={card} kindLabel={cardKindLabels[view.kind]} onPause={() => pause(card.id)} />

      <div
        className={`flex flex-1 flex-col justify-center px-5 pb-5 pt-3 md:px-10 md:pb-7 md:pt-4 ${
          isShortCue ? "text-center" : ""
        }`}
      >
        <p className="text-sm text-muted">{view.instruction}</p>
        {isListening ? (
          <div className="mt-3 flex justify-center">
            <button
              aria-label="Прослухати ще раз"
              className="inline-flex h-14 items-center gap-2.5 rounded-2xl border border-accent/30 bg-accent-soft px-6 text-base font-semibold text-accent transition hover:border-accent/60 active:scale-[0.98]"
              onClick={() => view.audio && void playEnglish(view.audio, { rate: 0.85 })}
              type="button"
            >
              <Headphones className="size-5" />
              Прослухати
            </button>
          </div>
        ) : (
          <h2
            className={`mt-1.5 text-balance font-semibold leading-snug tracking-tight ${
              isShortCue ? "text-2xl md:text-[32px] md:leading-tight" : "text-xl md:text-2xl"
            }`}
            lang={view.cueLanguage}
          >
            {view.cue}
          </h2>
        )}
        {view.kind === "recognition" && view.audio ? (
          <div className={`mt-1 ${isShortCue ? "flex justify-center" : ""}`}>
            <SpeakButton text={view.audio} />
          </div>
        ) : null}
        {view.context ? (
          <p
            className={`mt-2 text-[15px] leading-6 ${view.context.language === "en" ? "italic text-text-2" : "text-muted"}`}
            lang={view.context.language}
          >
            {view.context.text}
          </p>
        ) : null}
        {view.hint && !isRevealed ? <p className="mt-1.5 text-xs text-faint">{view.hint}</p> : null}
      </div>

      {!isRevealed ? (
        <div className="border-t border-line/70 bg-surface-1/40 p-4 md:p-5">
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
            placeholder={
              view.selfGraded ? "Впиши переклад або просто згадай" : "Впиши англійською"
            }
            rows={1}
            spellCheck={false}
            value={responseText}
            onChange={(event) => setResponseText(event.currentTarget.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" size="lg" variant="primary" onClick={reveal}>
              {typed ? "Перевірити" : view.selfGraded ? "Показати відповідь" : "Не знаю — показати"}
              <Kbd>Enter</Kbd>
            </Button>
            {isListening ? (
              <Button icon={SkipForward} size="lg" title="Немає звуку — пропустити вправу" onClick={() => skip(card.id)}>
                <span className="sr-only sm:not-sr-only">Без звуку</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="animate-reveal border-t border-line/70 bg-surface-1/40 px-5 py-4 md:px-10 md:py-6">
          <RevealedAnswer check={check} typed={typed} view={view} />
          {isLeech ? <LeechPanel onFix={fixWord} onPause={() => pause(card.id)} /> : null}
          <div ref={actionsRef} className="mt-4 scroll-mb-24">
            {isSelfRated ? (
              <SelfRating intervals={intervals} suggested={suggested} onGrade={grade} />
            ) : (
              <AutoRating
                intervals={intervals}
                rating={autoRating ?? "good"}
                showOverride={showOverride}
                onGrade={grade}
                onToggleOverride={() => setShowOverride((value) => !value)}
              />
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/** Stage badge, exercise name, edit and pause — the top row of every practice card. */
export function CardTopBar({ card, kindLabel, onPause }: { card: PracticeCard; kindLabel: string; onPause: () => void }) {
  const stage = cardStageBadge(card);
  return (
  <div className="flex items-center justify-between gap-3 px-4 pt-3 md:px-6 md:pt-4">
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge tone={stage.tone}>{stage.label}</Badge>
      <span className="text-xs text-faint">{kindLabel}</span>
    </div>
    <div className="flex shrink-0 items-center">
      <Link
        aria-label="Редагувати слово"
        className="grid size-10 place-items-center rounded-xl text-faint transition hover:bg-surface-4 hover:text-text"
        href={`/app/words/${card.userWordId}`}
        title="Редагувати слово"
      >
        <PencilLine className="size-4" />
      </Link>
      <button
        aria-label="Поставити картку на паузу"
        className="grid size-10 place-items-center rounded-xl text-faint transition hover:bg-surface-4 hover:text-text"
        onClick={onPause}
        title="Пауза: картка зникне з черги"
        type="button"
      >
        <PauseCircle className="size-4" />
      </button>
    </div>
  </div>
  );
}

function RevealedAnswer({ check, typed, view }: { check: AnswerCheck | null; typed: string; view: RenderedCard }) {
  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">Відповідь</p>
          <p
            className={`mt-1 font-semibold leading-snug tracking-tight text-accent-strong ${
              view.answer.length > 60 ? "text-lg md:text-xl" : "text-2xl md:text-[28px]"
            }`}
            lang={view.answerLanguage}
          >
            {view.answer}
          </p>
          {view.meaning || view.partOfSpeech ? (
            <p className="mt-0.5 text-sm text-muted">
              {view.meaning}
              {view.meaning && view.partOfSpeech ? " · " : ""}
              {view.partOfSpeech ? <span className="text-faint">{view.partOfSpeech}</span> : null}
            </p>
          ) : null}
        </div>
        {view.answerLanguage === "en" ? <SpeakButton className="mt-5" text={view.answer} /> : null}
      </div>

      {typed && check ? <AnswerComparison check={check} typed={typed} /> : null}

      {view.example ? (
        <div className="mt-3 rounded-2xl border border-line bg-surface-2/70 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[15px] italic leading-6 text-text-2" lang="en">
              {view.example.en}
            </p>
            <SpeakButton className="-my-1 -mr-2" label="Прослухати приклад" text={view.example.en} />
          </div>
          {view.example.uk ? <p className="mt-0.5 text-sm leading-5 text-muted">{view.example.uk}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function DiffText({ parts, wrongClass }: { parts: DiffPart[]; wrongClass: string }) {
  return (
    <>
      {parts.map((part, index) =>
        part.ok ? (
          <span key={index}>{part.text}</span>
        ) : (
          <mark key={index} className={`rounded-sm bg-transparent ${wrongClass}`}>
            {part.text}
          </mark>
        ),
      )}
    </>
  );
}

function AnswerComparison({ check, typed }: { check: AnswerCheck; typed: string }) {
  const verdict = verdictMeta[check.verdict];

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface-2/70 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs text-faint">Твоя відповідь</span>
        <span className="min-w-0 flex-1 break-words text-[15px] text-text" data-testid="typed-answer">
          {check.diff ? <DiffText parts={check.diff.typed} wrongClass="text-danger line-through decoration-danger/70" /> : typed}
        </span>
        {verdict.label ? (
          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${verdict.className}`}>
            {check.verdict === "exact" ? <Check className="size-3.5" /> : null}
            {verdict.label}
          </span>
        ) : null}
      </div>
      {check.diff ? (
        <p className="mt-1 text-[15px] text-text-2">
          <span className="mr-3 text-xs text-faint">Правильно</span>
          <DiffText parts={check.diff.expected} wrongClass="font-semibold text-amber underline decoration-amber/60 underline-offset-2" />
        </p>
      ) : null}
    </div>
  );
}

function LeechPanel({ onFix, onPause }: { onFix: (focus: "translation" | "example") => void; onPause: () => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-amber/30 bg-amber-soft/60 p-3" role="note">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber">
        <AlertTriangle className="size-4" />
        Це слово постійно вислизає
      </p>
      <p className="mt-1 text-xs leading-5 text-text-2">
        Часто допомагає інший переклад або власний приклад — з життя, а не з підручника.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onFix("translation")}>
          Змінити переклад
        </Button>
        <Button size="sm" onClick={() => onFix("example")}>
          Додати свій приклад
        </Button>
        <Button icon={PauseCircle} size="sm" variant="ghost" onClick={onPause}>
          Пауза
        </Button>
      </div>
    </div>
  );
}

function SelfRating({
  intervals,
  suggested,
  onGrade,
}: {
  intervals: Record<ReviewRating, string> | null;
  suggested: ReviewRating | null;
  onGrade: (rating: ReviewRating) => void;
}) {
  const options: Array<{ rating: ReviewRating; label: string; key: string }> = [
    { rating: "again", label: "Не згадав", key: "1" },
    { rating: "good", label: "Згадав", key: "2" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(({ rating, label, key }) => (
        <button
          key={rating}
          className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border px-1 py-2 transition active:scale-[0.97] ${
            suggested === rating ? ratingTone[rating].solid : ratingTone[rating].soft
          }`}
          onClick={() => onGrade(rating)}
          type="button"
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {label}
            <Kbd>{key}</Kbd>
          </span>
          {intervals ? <span className="mt-0.5 font-mono text-[11px] opacity-75">{intervals[rating]}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function AutoRating({
  intervals,
  rating,
  showOverride,
  onGrade,
  onToggleOverride,
}: {
  intervals: Record<ReviewRating, string> | null;
  rating: ReviewRating;
  showOverride: boolean;
  onGrade: (rating: ReviewRating) => void;
  onToggleOverride: () => void;
}) {
  return (
    <div>
      <Button className="w-full" size="lg" variant="primary" onClick={() => onGrade(rating)}>
        Далі
        <ArrowRight className="size-4" />
        <Kbd>Enter</Kbd>
      </Button>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-faint">
        <span data-testid="auto-rating">
          Оцінка: <span className="font-medium text-text-2">{ratingLabels[rating]}</span>
          {intervals ? ` · повтор через ${intervals[rating]}` : ""}
        </span>
        <button
          aria-expanded={showOverride}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-faint underline decoration-dotted underline-offset-2 transition hover:text-text"
          onClick={onToggleOverride}
          type="button"
        >
          <RotateCcw className="size-3" />
          змінити
        </button>
      </div>
      {showOverride ? (
        <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label="Інша оцінка">
          {ratingOrder.map((option, index) => (
            <button
              key={option}
              className={`flex flex-col items-center rounded-xl border px-1 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
                option === rating ? ratingTone[option].solid : ratingTone[option].soft
              }`}
              onClick={() => onGrade(option)}
              type="button"
            >
              <span className="flex items-center gap-1">
                {ratingLabels[option]}
                <Kbd>{index + 1}</Kbd>
              </span>
              {intervals ? <span className="font-mono text-[10px] font-normal opacity-75">{intervals[option]}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
