"use client";

import { ArrowDown, ArrowRight, Check, Clock3, Flame, Sparkles } from "lucide-react";
import type * as React from "react";
import { useRef, useState } from "react";
import { buttonClass } from "../shared-ui";
import { useCycle } from "./motion";

const rotatingWords = ["англійські слова", "QA-терміни", "нові фрази", "що завгодно"];

const stackCards = [
  {
    tag: "Англійська",
    tone: "green" as const,
    prompt: "Як сказати англійською: дедлайн зсувається?",
    answer: "the deadline slips",
    hint: "The deadline slips again.",
  },
  {
    tag: "QA",
    tone: "violet" as const,
    prompt: "Що таке smoke testing?",
    answer: "Швидка перевірка, що ключові функції працюють",
    hint: "Запускаємо одразу після деплою.",
  },
  {
    tag: "Англійська",
    tone: "green" as const,
    prompt: "Що означає «edge case»?",
    answer: "крайній, рідкісний випадок",
    hint: "This edge case breaks validation.",
  },
];

export function Hero({ onStart }: { onStart: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);
  const wordIndex = useCycle(rotatingWords.length, 2600);

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const section = sectionRef.current;
    if (!section || event.pointerType !== "mouse") return;
    const rect = section.getBoundingClientRect();
    section.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    section.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <section
      ref={sectionRef}
      className="grain relative isolate overflow-hidden pb-10 pt-28 md:pb-16 md:pt-36"
      id="top"
      onPointerMove={handlePointerMove}
    >
      <Aurora />
      <div aria-hidden="true" className="spotlight absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 text-center md:px-6">
        <a
          className="animate-rise group inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2/60 py-1 pl-1 pr-3 text-xs font-medium backdrop-blur"
          href="#how"
        >
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">FSRS</span>
          <span className="text-shimmer">Розумні інтервальні повторення</span>
          <ArrowRight className="size-3.5 text-muted transition group-hover:translate-x-0.5" />
        </a>

        <h1 className="animate-rise delay-1 mt-7 text-balance text-[clamp(32px,9.5vw,44px)] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl md:text-7xl lg:text-[84px]">
          Запам’ятовуй
          <span className="relative block h-[1.08em] overflow-hidden">
            <span key={wordIndex} className="word-in text-gradient pb-[0.08em]">
              {rotatingWords[wordIndex]}
            </span>
          </span>
          назавжди.
        </h1>

        <p className="animate-rise delay-2 mt-7 max-w-xl text-pretty text-base leading-7 text-text-2 md:text-lg md:leading-8">
          Memora — тренажер пам’яті. Ти згадуєш відповідь сам, а розумний
          розклад повертає картку саме тоді, коли вона почала б забуватися.
          10 хвилин на день замість годин зубріння.
        </p>

        <div className="animate-rise delay-3 mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <button
            className={buttonClass(
              "primary",
              "lg",
              "w-full px-7 shadow-[0_0_0_1px_rgba(108,240,214,0.4),0_14px_40px_-10px_rgba(62,224,191,0.65)] sm:w-auto",
            )}
            onClick={onStart}
            type="button"
          >
            Почати навчання
            <ArrowRight className="size-4" />
          </button>
          <a className={buttonClass("ghost", "lg", "w-full sm:w-auto")} href="#demo">
            Спробувати без реєстрації
            <ArrowDown className="size-4" />
          </a>
        </div>
      </div>

      <CardStack />
    </section>
  );
}

function Aurora() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-20 overflow-hidden">
      <div className="aurora-blob absolute -top-40 left-[8%] size-[520px] rounded-full bg-accent/25 blur-[120px]" />
      <div
        className="aurora-blob absolute -top-24 right-[4%] size-[460px] rounded-full bg-violet/25 blur-[120px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="aurora-blob absolute top-[45%] left-[35%] size-[420px] rounded-full bg-accent-strong/10 blur-[120px]"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}

function CardStack() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const step = useCycle(stackCards.length * 2, 2600);
  const cardIndex = Math.floor(step / 2) % stackCards.length;
  const isFlipped = step % 2 === 1;
  const card = stackCards[cardIndex];
  const next = stackCards[(cardIndex + 1) % stackCards.length];
  const after = stackCards[(cardIndex + 2) % stackCards.length];

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -y * 10, y: x * 14 });
  }

  return (
    <div className="relative mx-auto mt-16 w-full max-w-5xl px-4 md:mt-20 md:px-6">
      <FloatingChip className="left-[2%] top-[8%] hidden md:flex" delay="0s">
        <Flame className="size-4 text-amber" />
        12 днів поспіль
      </FloatingChip>
      <FloatingChip className="right-[3%] top-[2%] hidden md:flex" delay="-2s">
        <Check className="size-4 text-accent" />
        Точно!
      </FloatingChip>
      <FloatingChip className="bottom-[14%] left-[6%] hidden lg:flex" delay="-4s">
        <Clock3 className="size-4 text-violet" />
        наступне — через 4 дні
      </FloatingChip>
      <FloatingChip className="bottom-[6%] right-[7%] hidden md:flex" delay="-1s">
        <Sparkles className="size-4 text-accent" />
        +2 нові картки
      </FloatingChip>

      <div
        className="flip-scene animate-rise delay-3 relative mx-auto h-[300px] w-full max-w-[460px] sm:h-[320px]"
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        onPointerMove={handleMove}
      >
        <div
          className="relative size-full transition-transform duration-300 ease-out [transform-style:preserve-3d]"
          style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
        >
          <StackShadow card={after} className="translate-y-6 scale-[0.88] opacity-40 sm:translate-y-8 sm:-rotate-6" />
          <StackShadow card={next} className="translate-y-3 scale-[0.94] opacity-70 sm:translate-y-4 sm:rotate-3" />

          <div className={`flip-card absolute inset-0 ${isFlipped ? "is-flipped" : ""}`}>
            <div className="flip-face flex flex-col rounded-[28px] border border-line-strong bg-gradient-to-b from-surface-4 to-surface-2 p-6 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]">
              <CardTag card={card} />
              <p className="my-auto text-balance text-center text-2xl font-semibold leading-snug tracking-tight sm:text-[26px]">
                {card.prompt}
              </p>
              <div className="flex h-11 items-center rounded-2xl border border-line-strong bg-surface-1 px-4 text-left text-sm text-faint">
                <span className="caret">Згадую</span>
              </div>
            </div>
            <div className="flip-face flip-back flex flex-col rounded-[28px] border border-accent/40 bg-gradient-to-b from-surface-4 to-surface-2 p-6 shadow-[0_40px_100px_-30px_rgba(62,224,191,0.35)]">
              <CardTag card={card} />
              <div className="my-auto text-center">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">
                  Відповідь
                </p>
                <p className="mt-2 text-balance text-2xl font-semibold leading-snug tracking-tight text-accent-strong">
                  {card.answer}
                </p>
                <p className="mt-2 text-sm italic text-muted">{card.hint}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="flex h-12 flex-col items-center justify-center rounded-2xl border border-danger/25 bg-danger-soft text-xs font-semibold text-[#ffb4aa]">
                  Не згадав
                  <span className="font-mono text-[10px] font-normal opacity-75">10 хв</span>
                </span>
                <span className="flex h-12 flex-col items-center justify-center rounded-2xl bg-accent text-xs font-semibold text-accent-ink">
                  Згадав
                  <span className="font-mono text-[10px] font-normal opacity-75">4 дн</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardTag({ card }: { card: (typeof stackCards)[number] }) {
  return (
    <span
      className={`self-start rounded-md px-2 py-0.5 text-xs font-medium ${
        card.tone === "green" ? "bg-accent-soft text-accent" : "bg-violet-soft text-violet"
      }`}
    >
      {card.tag}
    </span>
  );
}

function StackShadow({
  card,
  className,
}: {
  card: (typeof stackCards)[number];
  className: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 flex flex-col rounded-[28px] border border-line-strong bg-surface-3 p-6 transition-all duration-700 ${className}`}
    >
      <CardTag card={card} />
      <p className="my-auto text-center text-xl font-semibold text-text-2 blur-[1px]">
        {card.prompt}
      </p>
    </div>
  );
}

function FloatingChip({
  children,
  className,
  delay,
}: {
  children: React.ReactNode;
  className: string;
  delay: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-float absolute z-10 items-center gap-2 rounded-full border border-line-strong bg-surface-2/80 px-3.5 py-2 text-sm font-medium text-text-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}
