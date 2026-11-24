"use client";

import { BookOpen, Briefcase, Check, MessagesSquare, Plane, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { completeOnboardingAction } from "@/lib/memora/actions/program";
import { unwrap } from "@/lib/memora/actions/result";
import { DAILY_MINUTES_OPTIONS, newWordsPerDay } from "@/lib/memora/pace";
import { GOALS, goalLabels, type Goal } from "@/lib/memora/program";
import {
  answer,
  BANDS,
  buildChecks,
  cefrFromVocab,
  scoreTest,
  startTest,
  testProgress,
  type CheckItem,
  type TestResult,
  type TestState,
} from "@/lib/memora/vocab-test";
import { vocabTestPool } from "@/lib/memora/vocab-test-pool";
import { hardNavigate } from "./hard-navigate";
import { Button, SegmentedControl, ShellPanel, StatusBanner } from "./shared-ui";
import { formatError, plural } from "./utils";

type Step = "intro" | "test" | "check" | "result" | "goals" | "minutes";

const goalIcons: Record<Goal, LucideIcon> = {
  general: BookOpen,
  work: Briefcase,
  travel: Plane,
  talk: MessagesSquare,
};

const goalHints: Record<Goal, string> = {
  general: "найчастотніші слова",
  work: "наради, листи, бізнес",
  travel: "аеропорт, готель, місто",
  talk: "живі фрази для розмови",
};

export function OnboardingFlow({
  initialGoals,
  initialMinutes,
  isRetake,
}: {
  initialGoals: Goal[];
  initialMinutes: number;
  isRetake: boolean;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [test, setTest] = useState<TestState | null>(null);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [checkAnswers, setCheckAnswers] = useState<Array<{ word: string; correct: boolean }>>([]);
  const [result, setResult] = useState<TestResult | null>(null);
  const [goals, setGoals] = useState<Goal[]>(initialGoals.length > 0 ? initialGoals : ["general"]);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishTest = useCallback((state: TestState) => {
    const items = buildChecks(state, vocabTestPool);
    if (items.length === 0) {
      setResult(scoreTest(state, []));
      setStep("result");
    } else {
      setChecks(items);
      setCheckAnswers([]);
      setStep("check");
    }
  }, []);

  const answerYesNo = useCallback(
    (yes: boolean) => {
      if (!test || test.done) return;
      const next = answer(test, yes, vocabTestPool);
      setTest(next);
      if (next.done) finishTest(next);
    },
    [test, finishTest],
  );

  const answerCheck = useCallback(
    (index: number | null) => {
      const item = checks[checkAnswers.length];
      if (!item || !test) return;
      const next = [...checkAnswers, { word: item.word, correct: index === item.answer }];
      setCheckAnswers(next);
      if (next.length === checks.length) {
        setResult(scoreTest(test, next));
        setStep("result");
      }
    },
    [checks, checkAnswers, test],
  );

  async function start() {
    setIsSaving(true);
    setError(null);
    try {
      unwrap(
        await completeOnboardingAction({
          test: test
            ? {
                answers: test.items.map((item, index) => ({ word: item.word, yes: test.answers[index] })),
                checks: checkAnswers,
              }
            : null,
          goals,
          dailyMinutes: minutes,
        }),
      );
      hardNavigate("/app");
    } catch (saveError) {
      setError(formatError(saveError));
      setIsSaving(false);
    }
  }

  const stepNumber = step === "goals" ? 2 : step === "minutes" ? 3 : 1;
  const progress =
    step === "test" && test
      ? testProgress(test) * 0.8
      : step === "check"
        ? 0.8 + (checkAnswers.length / Math.max(checks.length, 1)) * 0.2
        : step === "intro"
          ? 0
          : 1;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="shrink-0 font-medium text-text-2">
          Крок {stepNumber} з 3 · {stepNumber === 1 ? "рівень" : stepNumber === 2 ? "цілі" : "темп"}
        </span>
        {stepNumber === 1 ? (
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        {step === "intro" ? (
          <Intro
            isRetake={isRetake}
            onStart={() => {
              setTest(startTest(vocabTestPool));
              setStep("test");
            }}
            onSkip={() => {
              setTest(null);
              setStep("goals");
            }}
          />
        ) : null}
        {step === "test" && test ? <YesNo state={test} onAnswer={answerYesNo} /> : null}
        {step === "check" && checks[checkAnswers.length] ? (
          <MeaningCheck
            item={checks[checkAnswers.length]}
            position={checkAnswers.length + 1}
            total={checks.length}
            onAnswer={answerCheck}
          />
        ) : null}
        {step === "result" && result ? <Result result={result} onNext={() => setStep("goals")} /> : null}
        {step === "goals" ? (
          <Goals goals={goals} onChange={setGoals} onNext={() => setStep("minutes")} />
        ) : null}
        {step === "minutes" ? (
          <Minutes minutes={minutes} onChange={setMinutes} isSaving={isSaving} onStart={() => void start()} />
        ) : null}
        {error ? <StatusBanner className="mt-3" tone="error" message={error} /> : null}
      </div>
    </div>
  );
}

function Intro({ isRetake, onStart, onSkip }: { isRetake: boolean; onStart: () => void; onSkip: () => void }) {
  return (
    <ShellPanel className="p-5 md:p-6">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
        {isRetake ? "Перевіримо рівень ще раз" : "Спершу визначимо твій рівень"}
      </h1>
      <ul className="mt-3 space-y-1.5 text-sm leading-6 text-text-2">
        <li>• Бачиш англійське слово — відповідаєш, чи знаєш його. 4–6 хвилин.</li>
        <li>• Деякі слова вигадані: якщо не впевнений — тисни «Не знаю».</li>
        <li>• Наприкінці кілька слів перепитаємо: обрати переклад.</li>
      </ul>
      <p className="mt-3 text-sm leading-6 text-muted">
        За результатом Memora підбере слова твого рівня, а знайомі одразу поведе в активні вправи.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" size="lg" onClick={onStart}>
          Почати тест
        </Button>
        <Button variant="ghost" size="lg" onClick={onSkip}>
          {isRetake ? "Без тесту — змінити цілі й темп" : "Пропустити — почати з найпоширеніших слів"}
        </Button>
      </div>
    </ShellPanel>
  );
}

function useKeys(handler: (key: string) => void) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
      handler(event.key);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handler]);
}

function YesNo({ state, onAnswer }: { state: TestState; onAnswer: (yes: boolean) => void }) {
  const item = state.items[state.answers.length];
  useKeys(
    useCallback(
      (key: string) => {
        if (key === "ArrowLeft" || key === "n" || key === "т") onAnswer(false);
        if (key === "ArrowRight" || key === "y" || key === "н" || key === "Enter") onAnswer(true);
      },
      [onAnswer],
    ),
  );
  if (!item) return null;

  return (
    <ShellPanel className="p-5 md:p-6">
      <p className="text-center text-xs text-muted">Знаєш це слово?</p>
      <p
        className="mt-6 mb-7 break-words text-center text-3xl font-semibold tracking-tight md:text-4xl"
        data-testid="test-word"
        lang="en"
      >
        {item.word}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={() => onAnswer(false)}>
          Не знаю
        </Button>
        <Button size="lg" variant="primary" onClick={() => onAnswer(true)}>
          Знаю
        </Button>
      </div>
      <p className="mt-3 hidden text-center text-xs text-faint md:block">← не знаю · знаю →</p>
    </ShellPanel>
  );
}

function MeaningCheck({
  item,
  position,
  total,
  onAnswer,
}: {
  item: CheckItem;
  position: number;
  total: number;
  onAnswer: (index: number | null) => void;
}) {
  return (
    <ShellPanel className="p-5 md:p-6">
      <p className="text-center text-xs text-muted">
        Перевірка {position} з {total} · що означає слово?
      </p>
      <p className="mt-4 mb-5 break-words text-center text-3xl font-semibold tracking-tight" lang="en">
        {item.word}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {item.options.map((option, index) => (
          <Button key={`${item.word}-${option}`} size="lg" onClick={() => onAnswer(index)}>
            {option}
          </Button>
        ))}
      </div>
      <Button className="mt-2 w-full" variant="ghost" onClick={() => onAnswer(null)}>
        Не знаю
      </Button>
    </ShellPanel>
  );
}

function Result({ result, onNext }: { result: TestResult; onNext: () => void }) {
  const level = cefrFromVocab(result.vocab);
  return (
    <ShellPanel className="p-5 md:p-6">
      <p className="text-xs text-muted">Твій пасивний словник</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight" data-testid="test-vocab">
        ≈ {result.vocab.toLocaleString("uk-UA")} слів
        <span className="ml-2 align-middle text-base font-medium text-accent">рівень ≈ {level}</span>
      </p>
      <div className="mt-4" aria-label="Скільки слів знаєш у кожній тисячі">
        <div className="flex h-20 items-end gap-1">
          {Array.from({ length: BANDS }, (_, index) => {
            const share = result.bands[index] ?? 0;
            return (
              <div key={index} className="flex h-full flex-1 flex-col justify-end rounded bg-surface-3">
                <div
                  className="rounded bg-gradient-to-t from-accent/70 to-accent"
                  style={{ height: `${Math.max(3, Math.round(share * 100))}%` }}
                  title={`${index + 1}-а тисяча: ${Math.round(share * 100)}%`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1 text-center font-mono text-[10px] text-faint">
          {Array.from({ length: BANDS }, (_, index) => (
            <span key={index} className="flex-1">
              {index + 1}k
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-2">
        Стовпчики — яку частку слів кожної тисячі (від найчастотніших) ти впізнаєш. Слова, які вже впізнаєш,
        підуть одразу у вправи «згадай англійською». Програма підлаштується за першими тижнями практики.
      </p>
      <Button className="mt-5 w-full sm:w-auto" variant="primary" size="lg" onClick={onNext}>
        Далі
      </Button>
    </ShellPanel>
  );
}

function Goals({ goals, onChange, onNext }: { goals: Goal[]; onChange: (goals: Goal[]) => void; onNext: () => void }) {
  return (
    <ShellPanel className="p-5 md:p-6">
      <h1 className="text-xl font-semibold tracking-tight">Для чого тобі англійська?</h1>
      <p className="mt-1 text-sm text-muted">Можна кілька. Змінити можна будь-коли в профілі.</p>
      <GoalPicker className="mt-4" goals={goals} onChange={onChange} />
      <Button className="mt-5 w-full sm:w-auto" variant="primary" size="lg" disabled={goals.length === 0} onClick={onNext}>
        Далі
      </Button>
    </ShellPanel>
  );
}

export function GoalPicker({
  goals,
  onChange,
  className = "",
  disabled = false,
}: {
  goals: Goal[];
  onChange: (goals: Goal[]) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {GOALS.map((goal) => {
        const Icon = goalIcons[goal];
        const selected = goals.includes(goal);
        return (
          <button
            key={goal}
            aria-pressed={selected}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
              selected
                ? "border-accent/70 bg-accent-soft text-text"
                : "border-line-strong bg-surface-3/40 text-text-2 hover:border-accent/40"
            }`}
            disabled={disabled}
            onClick={() => onChange(selected ? goals.filter((item) => item !== goal) : GOALS.filter((item) => item === goal || goals.includes(item)))}
            type="button"
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${selected ? "text-accent" : "text-muted"}`} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-semibold">
                {goalLabels[goal]}
                {selected ? <Check className="size-3.5 text-accent" /> : null}
              </span>
              <span className="block text-xs leading-5 text-muted">{goalHints[goal]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Minutes({
  minutes,
  onChange,
  isSaving,
  onStart,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  isSaving: boolean;
  onStart: () => void;
}) {
  return (
    <ShellPanel className="p-5 md:p-6">
      <h1 className="text-xl font-semibold tracking-tight">Скільки часу на день?</h1>
      <SegmentedControl
        ariaLabel="Хвилин на день"
        className="mt-4 w-full"
        options={DAILY_MINUTES_OPTIONS.map((value) => ({ value: String(value), label: `${value} хв` }))}
        value={String(minutes)}
        onChange={(value) => onChange(Number(value))}
      />
      <p className="mt-2 text-sm leading-6 text-muted">
        Це ≈ {plural(newWordsPerDay(minutes, 0), ["нове слово", "нові слова", "нових слів"])} на день плюс повторення.
        Свої слова й слова з текстів ідуть першими, програма доповнює решту.
      </p>
      <Button className="mt-5 w-full sm:w-auto" variant="primary" size="lg" isLoading={isSaving} onClick={onStart}>
        {isSaving ? "Готуємо слова…" : "Почати"}
      </Button>
    </ShellPanel>
  );
}
