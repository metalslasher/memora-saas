"use client";

import { Check, ChevronRight, PauseCircle, X } from "lucide-react";
import type { ReviewRating, StudyCard } from "@/lib/memora/types";
import { EmptyState, ShellPanel } from "./shared-ui";

export function StudyPanel({
  card,
  queueLength,
  sessionTotal,
  responseText,
  isRevealed,
  isBusy,
  reviewButtons,
  onResponseChange,
  onReveal,
  onHideAnswer,
  onReview,
  onSuspend,
}: {
  card: StudyCard | null;
  queueLength: number;
  sessionTotal: number;
  responseText: string;
  isRevealed: boolean;
  isBusy: boolean;
  reviewButtons: "simple" | "advanced";
  onResponseChange: (value: string) => void;
  onReveal: () => void;
  onHideAnswer: () => void;
  onReview: (rating: ReviewRating) => void;
  onSuspend: (cardId: string) => void;
}) {
  if (!card) {
    if (sessionTotal > 0) {
      return (
        <ShellPanel className="min-h-[360px] p-4 md:min-h-[420px] md:p-5">
          <PracticeProgress
            completed={sessionTotal}
            total={sessionTotal}
          />
          <div className="grid min-h-[260px] place-items-center">
            <EmptyState
              icon={Check}
              title="Черга порожня"
              description="Активних карток у цьому режимі немає."
            />
          </div>
        </ShellPanel>
      );
    }

    return (
      <ShellPanel className="grid min-h-[360px] place-items-center p-6 md:min-h-[420px]">
        <EmptyState
          icon={Check}
          title="Черга порожня"
          description="Активних карток у цьому режимі немає."
        />
      </ShellPanel>
    );
  }

  const revealDisabled = responseText.trim().length === 0;
  const totalCards = Math.max(sessionTotal, queueLength, 1);
  const completedCards = Math.min(
    totalCards,
    Math.max(0, totalCards - queueLength),
  );

  return (
    <ShellPanel className="p-4 md:p-5">
      <PracticeProgress
        completed={completedCards}
        total={totalCards}
      />

      <div className="mt-6">
        <p className="text-sm font-medium text-[#9aa8ba]">Питання</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
          {card.prompt}
        </h2>
      </div>

      {!isRevealed ? (
        <div>
          <label className="mt-7 block">
            <span className="text-sm font-medium text-[#9aa8ba]">Відповідь</span>
            <textarea
              className="mt-2 min-h-32 w-full resize-none rounded-lg border border-[#263140] bg-[#0b111a] p-4 text-base text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
              value={responseText}
              onChange={(event) => onResponseChange(event.target.value)}
              placeholder="Напиши з пам'яті."
            />
          </label>

          <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab] sm:w-auto"
              disabled={revealDisabled || isBusy}
              onClick={onReveal}
            >
              Перевірити відповідь
              <ChevronRight className="size-4" />
            </button>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#263140] px-4 py-3 text-sm font-medium text-[#c7d0dd] transition hover:border-[#ef6351] hover:text-[#ff8d7f] sm:w-auto"
              title="Призупинити цю картку"
              disabled={isBusy}
              onClick={() => onSuspend(card.id)}
            >
              <PauseCircle className="size-4" />
              Поставити на паузу
            </button>
          </div>
        </div>
      ) : null}

      {isRevealed ? (
        <AnswerDialog
          card={card}
          isBusy={isBusy}
          reviewButtons={reviewButtons}
          onClose={onHideAnswer}
          onReview={onReview}
        />
      ) : null}
    </ShellPanel>
  );
}

function AnswerDialog({
  card,
  isBusy,
  reviewButtons,
  onClose,
  onReview,
}: {
  card: StudyCard;
  isBusy: boolean;
  reviewButtons: "simple" | "advanced";
  onClose: () => void;
  onReview: (rating: ReviewRating) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#02050a]/70 px-3 py-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Правильна відповідь"
    >
      <button
        className="absolute inset-0 cursor-default"
        aria-label="Закрити відповідь"
        onClick={onClose}
        type="button"
      />
      <div className="relative max-h-[calc(100vh-2.5rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#263140] bg-[#10161f] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.5)] md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#52e0c4]">
              Правильна відповідь
            </p>
            <h3
              className="mt-2 text-2xl font-semibold leading-tight text-[#eef4ff]"
            >
              {card.answer}
            </h3>
          </div>
          <button
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#263140] text-[#9aa8ba] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
            aria-label="Закрити відповідь"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        {card.explanation ? (
          <p className="mt-4 text-sm leading-6 text-[#c7d0dd]">
            {card.explanation}
          </p>
        ) : null}
        {card.example ? (
          <p className="mt-4 rounded-lg border border-[#263140] bg-[#0b111a] p-3 text-sm leading-6 text-[#c7d0dd]">
            {card.example}
          </p>
        ) : null}

        <div
          className={`mt-5 grid gap-2 ${
            reviewButtons === "advanced"
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-2"
          }`}
        >
          <GradeButton
            tone="red"
            label="Знову"
            disabled={isBusy}
            onClick={() => onReview("again")}
          />
          {reviewButtons === "advanced" ? (
            <GradeButton
              tone="amber"
              label="Важко"
              disabled={isBusy}
              onClick={() => onReview("hard")}
            />
          ) : null}
          <GradeButton
            tone="green"
            label="Добре"
            disabled={isBusy}
            onClick={() => onReview("good")}
          />
          {reviewButtons === "advanced" ? (
            <GradeButton
              tone="dark"
              label="Легко"
              disabled={isBusy}
              onClick={() => onReview("easy")}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PracticeProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (total <= 0) return null;

  const segmentCount = Math.min(total, 30);
  const completedSegments = Math.min(
    segmentCount,
    Math.max(0, Math.round((completed / total) * segmentCount)),
  );

  return (
    <div
      aria-label={`Прогрес практики: ${completed} з ${total}`}
      className="grid h-2.5 w-full gap-1"
      style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: segmentCount }).map((_, index) => (
        <div
          key={index}
          className={`h-full rounded-full transition-colors duration-300 ${
            index < completedSegments ? "bg-[#2dd4bf]" : "bg-[#182230]"
          }`}
        />
      ))}
    </div>
  );
}

function GradeButton({
  tone,
  label,
  disabled = false,
  onClick,
}: {
  tone: "red" | "amber" | "green" | "dark";
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const classes = {
    red: "bg-[#ef6351] hover:bg-[#d95645]",
    amber: "bg-[#f2a84a] text-[#071018] hover:bg-[#ffc063]",
    green: "bg-[#2dd4bf] text-[#071018] hover:bg-[#5eead4]",
    dark: "bg-[#202938] hover:bg-[#344052]",
  };

  return (
    <button
      className={`inline-flex h-12 w-full min-w-0 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-55 ${classes[tone]}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
