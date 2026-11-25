"use client";

import { RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { checkAnswer } from "@/lib/memora/answer-check";
import { autoGrade, ratingLabels } from "@/lib/memora/auto-grade";
import { findCloze } from "@/lib/memora/cloze";
import type { ReviewRating } from "@/lib/memora/types";
import { buttonClass } from "../button-class";
import { PlayClip } from "./play-clip";

// The same cloze finder and answer checker as in practice, on a sample card.
const sentence = "I finally figured it out.";
const cloze = findCloze("figure out", sentence) ?? { text: "I finally _____ it _____.", answer: "figured out" };

const gradeNote: Record<ReviewRating, { tone: string; text: string }> = {
  again: { tone: "bg-danger-soft text-danger", text: "Слово повернеться ще сьогодні." },
  hard: { tone: "bg-amber-soft text-amber", text: "Згадав, але не чисто — повтор буде раніше." },
  good: { tone: "bg-accent-soft text-accent", text: "Звичайна пауза до наступного повтору." },
  easy: { tone: "bg-accent-soft text-accent", text: "Швидко й точно — пауза буде довшою." },
};

const verdictText = {
  exact: "Точно",
  close: "Є описка",
  form: "Інша форма",
  synonym: "Синонім",
  different: "Не збігається",
} as const;

export function DemoCard() {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ verdict: keyof typeof verdictText | null; rating: ReviewRating } | null>(null);
  const shownAt = useRef<number | null>(null);

  function submit() {
    const check = checkAnswer(typed, { answers: [cloze.answer] });
    const elapsedMs = shownAt.current ? Date.now() - shownAt.current : 60_000;
    const rating =
      autoGrade({ verdict: check.verdict, elapsedMs, answer: cloze.answer, state: "Review" }) ?? "again";
    const verdict = check.verdict in verdictText ? (check.verdict as keyof typeof verdictText) : null;
    setResult({ verdict, rating });
  }

  function reset() {
    setTyped("");
    setResult(null);
    shownAt.current = null;
  }

  const note = result ? gradeNote[result.rating] : null;

  return (
    <article
      aria-label="Приклад картки"
      className="overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-b from-surface-3 to-surface-2 shadow-[0_40px_100px_-50px_rgba(62,224,191,0.55)]"
    >
      <div className="flex items-center gap-2 px-4 pt-4 text-xs">
        <span className="rounded-md bg-surface-4 px-2 py-0.5 font-medium text-text-2">Повторення</span>
        <span className="text-faint">пропуск у реченні</span>
      </div>

      <div className="px-5 pb-5 pt-5 text-center">
        <p className="text-sm text-muted">Встав пропущене слово</p>
        <p className="mt-2 text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-[28px]" lang="en">
          {result ? (
            <>
              I finally <span className="text-accent-strong">figured</span> it{" "}
              <span className="text-accent-strong">out</span>.
            </>
          ) : (
            cloze.text
          )}
        </p>
        <p className="mt-2 text-sm text-text-2">Я нарешті в цьому розібрався.</p>
      </div>

      {result && note ? (
        <div className="animate-reveal border-t border-line/70 bg-surface-1/40 px-4 py-4">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-accent-strong" lang="en">
              figure out
            </p>
            <PlayClip label="Прослухати речення" src="/landing/figured-it-out.mp3" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {result.verdict ? (
              <span className="rounded-md bg-surface-4 px-2 py-1 text-text-2">{verdictText[result.verdict]}</span>
            ) : null}
            <span className={`rounded-md px-2 py-1 ${note.tone}`}>Оцінка: {ratingLabels[result.rating]}</span>
          </div>
          <p className="mt-2 text-sm text-muted">{note.text}</p>
          <button className={buttonClass("secondary", "md", "mt-3 w-full")} onClick={reset} type="button">
            <RotateCcw className="size-4" />
            Ще раз
          </button>
        </div>
      ) : (
        <form
          className="border-t border-line/70 bg-surface-1/40 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor="demo-answer">
            Пропущене слово англійською
          </label>
          <input
            autoCapitalize="off"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-line-strong bg-surface-1 px-4 text-base outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/15"
            id="demo-answer"
            lang="en"
            placeholder="Впиши англійською"
            spellCheck={false}
            value={typed}
            onChange={(event) => {
              if (shownAt.current === null) shownAt.current = Date.now();
              setTyped(event.target.value);
            }}
            onFocus={() => {
              if (shownAt.current === null) shownAt.current = Date.now();
            }}
          />
          <button className={buttonClass("primary", "lg", "mt-2.5 w-full")} type="submit">
            {typed.trim() ? "Перевірити" : "Не знаю — показати"}
          </button>
        </form>
      )}
    </article>
  );
}
