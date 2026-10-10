"use client";

import {
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  FileUp,
  Keyboard,
  Smartphone,
  SpellCheck,
  Volume2,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Reveal, useCycle, useInView, useScrollProgress } from "./motion";

/* ---------- Marquee ---------- */

const marqueeTop = [
  ["deadline", "дедлайн"],
  ["edge case", "крайній випадок"],
  ["to deploy", "викотити реліз"],
  ["flaky test", "нестабільний тест"],
  ["handoff", "передача задачі"],
  ["to estimate", "оцінити"],
  ["bottleneck", "вузьке місце"],
  ["requirement", "вимога"],
];

const marqueeBottom = [
  "Regression testing",
  "Boundary values",
  "Smoke testing",
  "Equivalence partitioning",
  "Test plan",
  "Severity vs priority",
  "Retest",
  "Acceptance criteria",
];

export function Marquee() {
  return (
    <section aria-label="Приклади карток" className="marquee-mask space-y-3 overflow-hidden py-10">
      <div className="marquee-left flex w-max gap-3">
        {[...marqueeTop, ...marqueeTop].map(([en, uk], index) => (
          <span
            key={`${en}-${index}`}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface-2/70 px-4 py-2 text-sm"
          >
            <span className="font-semibold text-text">{en}</span>
            <span className="text-faint">→</span>
            <span className="text-muted">{uk}</span>
          </span>
        ))}
      </div>
      <div className="marquee-right flex w-max gap-3">
        {[...marqueeBottom, ...marqueeBottom].map((term, index) => (
          <span
            key={`${term}-${index}`}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface-2/70 px-4 py-2 text-sm text-text-2"
          >
            <span className="size-1.5 rounded-full bg-violet" />
            {term}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---------- Scroll statement ---------- */

const statement =
  "Ти вивчив слово сьогодні. Через тиждень від нього майже нічого не лишилось. Memora повертає кожну картку саме тоді, коли вона починає згасати — і з кожним разом пам’ять тримає її довше.";

export function ScrollStatement() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();
  const words = statement.split(" ");
  const lit = Math.round(progress * 1.25 * words.length);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24 md:px-6 md:py-36">
      <div ref={ref}>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Чому це працює
        </p>
        <p className="mt-6 text-balance text-[28px] font-semibold leading-[1.25] tracking-tight md:text-5xl md:leading-[1.15]">
          {words.map((word, index) => (
            <span
              key={index}
              className={`transition-colors duration-300 ${
                index < lit
                  ? word.startsWith("Memora")
                    ? "text-accent-strong"
                    : "text-text"
                  : "text-surface-4"
              }`}
            >
              {word}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ---------- Sticky steps with phone ---------- */

const steps = [
  {
    title: "Додай, що хочеш запам’ятати",
    text: "Слово, фразу чи QA-термін — за 10 секунд вручну або цілим списком із таблиці. Memora сама зробить картки в обидва боки.",
  },
  {
    title: "Згадай без підказки",
    text: "Спершу відповідаєш сам — письмово чи подумки. Memora перевірить відповідь і пробачить дрібні описки.",
  },
  {
    title: "Повернись саме вчасно",
    text: "Алгоритм FSRS рахує, коли картка почне забуватися. Легке повертається через тижні, складне — вже сьогодні.",
  },
];

export function StickySteps() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.step));
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const element of stepRefs.current) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative mx-auto w-full max-w-6xl scroll-mt-20 px-4 md:px-6" id="how">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Як це працює
        </p>
        <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Три кроки. Щодня.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:mt-4 lg:grid-cols-2 lg:gap-16">
        <div>
          {steps.map((step, index) => (
            <div
              key={step.title}
              ref={(element) => {
                stepRefs.current[index] = element;
              }}
              className="flex flex-col justify-center py-6 lg:min-h-[75vh]"
              data-step={index}
            >
              <Reveal>
                <span
                  className={`font-mono text-sm transition-colors duration-500 ${
                    active === index ? "text-accent" : "text-faint"
                  }`}
                >
                  0{index + 1} / 03
                </span>
                <h3
                  className={`mt-3 text-3xl font-semibold tracking-tight transition-colors duration-500 md:text-4xl ${
                    active === index ? "text-text" : "text-text lg:text-faint"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="mt-4 max-w-md text-base leading-7 text-muted md:text-lg md:leading-8">
                  {step.text}
                </p>
              </Reveal>
              <div className="mt-8 lg:hidden">
                <Phone>
                  <PhoneScreen index={index} />
                </Phone>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-[12vh] flex h-[76vh] items-center justify-center">
            <div className="absolute size-[420px] rounded-full bg-accent/10 blur-[100px]" />
            <Phone>
              <PhoneScreen key={active} index={active} />
            </Phone>
          </div>
        </div>
      </div>
    </section>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[280px] rounded-[44px] border border-line-strong bg-surface-1 p-2.5 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="absolute left-1/2 top-4 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
      <div className="relative h-[540px] overflow-hidden rounded-[36px] bg-ink px-4 pb-4 pt-12">
        {children}
      </div>
    </div>
  );
}

function useTypewriter(text: string, speed = 90) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCount((current) => (current >= text.length + 14 ? 0 : current + 1));
    }, speed);
    return () => window.clearInterval(timer);
  }, [speed, text.length]);

  return text.slice(0, Math.min(count, text.length));
}

function PhoneScreen({ index }: { index: number }) {
  if (index === 0) return <PhoneAdd />;
  if (index === 1) return <PhoneRecall />;
  return <PhoneSchedule />;
}

function PhoneAdd() {
  const typed = useTypewriter("deadline");
  const done = typed === "deadline";

  return (
    <div className="animate-fade flex h-full flex-col">
      <p className="text-lg font-semibold">Додати слово</p>
      <p className="mt-1 text-xs text-muted">Картки створяться автоматично</p>
      <label className="mt-6 text-xs font-medium text-text-2">Англійською</label>
      <div className="mt-1.5 flex h-11 items-center rounded-xl border border-accent bg-surface-1 px-3 text-sm ring-4 ring-accent/15">
        <span className="caret">{typed}</span>
      </div>
      <label className="mt-4 text-xs font-medium text-text-2">Переклад</label>
      <div className="mt-1.5 flex h-11 items-center rounded-xl border border-line-strong bg-surface-1 px-3 text-sm text-text-2">
        {done ? "дедлайн, кінцевий термін" : ""}
      </div>
      <div
        className={`mt-5 space-y-2 transition-all duration-500 ${done ? "opacity-100" : "translate-y-2 opacity-0"}`}
      >
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
          <p className="text-faint">картка 1</p>
          <p className="mt-1 text-text">Як сказати англійською: дедлайн?</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
          <p className="text-faint">картка 2</p>
          <p className="mt-1 text-text">Що означає «deadline»?</p>
        </div>
      </div>
      <div className="mt-auto flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-ink">
        Додати
      </div>
    </div>
  );
}

function PhoneRecall() {
  const typed = useTypewriter("deadlin", 120);
  const checked = typed === "deadlin";

  return (
    <div className="animate-fade flex h-full flex-col">
      <div className="h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-accent to-violet" />
      </div>
      <div className="mt-4 flex flex-1 flex-col rounded-3xl border border-line-strong bg-surface-2 p-4">
        <span className="self-start rounded-md bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
          Англійська
        </span>
        <p className="my-auto text-center text-xl font-semibold leading-snug">
          Як сказати англійською: дедлайн?
        </p>
        {checked ? (
          <div className="animate-reveal rounded-2xl bg-surface-1 p-3">
            <p className="text-lg font-semibold text-accent-strong">deadline</p>
            <span className="mt-2 inline-flex rounded-md bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber">
              Майже — є описка
            </span>
          </div>
        ) : (
          <div className="flex h-11 items-center rounded-xl border border-line-strong bg-surface-1 px-3 text-sm">
            <span className="caret">{typed}</span>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex h-12 flex-col items-center justify-center rounded-xl border border-danger/25 bg-danger-soft text-xs font-semibold text-[#ffb4aa]">
          Не згадав
          <span className="font-mono text-[10px] opacity-70">10 хв</span>
        </div>
        <div
          className={`flex h-12 flex-col items-center justify-center rounded-xl text-xs font-semibold transition ${
            checked ? "bg-accent text-accent-ink" : "border border-accent/25 bg-accent-soft text-accent"
          }`}
        >
          Згадав
          <span className="font-mono text-[10px] opacity-70">3 дн</span>
        </div>
      </div>
    </div>
  );
}

const timeline = ["сьогодні", "3 дні", "9 днів", "3 тижні", "2 місяці", "6 місяців"];

function PhoneSchedule() {
  const lit = useCycle(timeline.length + 2, 700);

  return (
    <div className="animate-fade flex h-full flex-col">
      <p className="text-lg font-semibold">Шлях картки</p>
      <p className="mt-1 text-xs text-muted">deadline → дедлайн</p>
      <ol className="relative mt-6 space-y-4 pl-6">
        <span className="absolute bottom-2 left-[7px] top-2 w-px bg-line-strong" />
        {timeline.map((label, index) => (
          <li key={label} className="relative flex items-center justify-between">
            <span
              className={`absolute -left-6 grid size-4 place-items-center rounded-full border-2 transition-colors duration-300 ${
                index <= lit ? "border-accent bg-accent" : "border-line-strong bg-ink"
              }`}
            >
              {index <= lit ? <Check className="size-2.5 text-accent-ink" strokeWidth={4} /> : null}
            </span>
            <span className={`text-sm transition-colors ${index <= lit ? "text-text" : "text-faint"}`}>
              Повторення {index + 1}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-xs transition-colors ${
                index <= lit ? "bg-accent-soft text-accent" : "bg-surface-3 text-faint"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-auto rounded-2xl border border-line bg-surface-2 p-4 text-center">
        <p className="text-xs text-muted">Інтервал росте з кожним вдалим згадуванням</p>
        <p className="mt-1 text-xl font-semibold text-gradient">щоразу довше</p>
      </div>
    </div>
  );
}

/* ---------- Bento ---------- */

export function Bento() {
  return (
    <section className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-24 md:px-6 md:py-32" id="features">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Можливості</p>
        <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Усе для практики. Нічого зайвого.
        </h2>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
        <Tile
          className="md:col-span-4"
          icon={CalendarClock}
          title="Розклад, що підлаштовується під тебе"
          text="FSRS — сучасний алгоритм інтервальних повторень (той самий, що в Anki). Кожна картка має власний темп."
        >
          <ScheduleVisual />
        </Tile>
        <Tile
          className="md:col-span-2"
          icon={SpellCheck}
          title="Перевірка з розумінням"
          text="Регістр, артиклі, описки й синоніми — не проблема."
        >
          <TypoVisual />
        </Tile>
        <Tile className="md:col-span-2" icon={Volume2} title="Вимова" text="Прослухай слово чи приклад одним дотиком.">
          <WaveVisual />
        </Tile>
        <Tile className="md:col-span-2" icon={Keyboard} title="Швидко з клавіатури" text="Enter, 1–4, Z — і руки не відриваються.">
          <KeysVisual />
        </Tile>
        <Tile className="md:col-span-2" icon={BarChart3} title="Прогрес і серії" text="Календар активності й прогноз повторень.">
          <HeatVisual />
        </Tile>
        <Tile className="md:col-span-3" icon={FileUp} title="Імпорт списком" text="Перетягни CSV з Google Таблиць — сотня слів за секунди.">
          <ImportVisual />
        </Tile>
        <Tile className="md:col-span-3" icon={Smartphone} title="Як застосунок на телефоні" text="Додай на головний екран — і практикуй у дорозі.">
          <PhoneNavVisual />
        </Tile>
      </div>
    </section>
  );
}

function Tile({
  children,
  className,
  icon: Icon,
  text,
  title,
}: {
  children: React.ReactNode;
  className: string;
  icon: typeof Check;
  text: string;
  title: string;
}) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.25 });

  return (
    <div
      ref={ref}
      className={`reveal ${isInView ? "is-visible" : ""} group relative flex min-h-[300px] flex-col overflow-hidden rounded-3xl border border-line bg-surface-2/60 p-6 transition-colors hover:border-line-strong ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex min-h-[120px] flex-1 items-center justify-center">
        {isInView ? children : null}
      </div>
      <div className="mt-6">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Icon className="size-4 text-accent" />
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-muted">{text}</p>
      </div>
    </div>
  );
}

function ScheduleVisual() {
  const chips = ["10 хв", "1 день", "4 дні", "2 тижні", "2 місяці", "8 місяців"];

  return (
    <div className="w-full">
      <svg className="h-24 w-full" preserveAspectRatio="none" viewBox="0 0 600 100">
        <path
          d="M0 90 C 60 20, 90 20, 110 70 S 170 20, 220 55 S 330 15, 380 40 S 520 10, 600 22"
          fill="none"
          stroke="url(#bento-curve)"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <defs>
          <linearGradient id="bento-curve" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent-strong)" />
            <stop offset="1" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {chips.map((chip, index) => (
          <span
            key={chip}
            className="rounded-lg px-2.5 py-1 font-mono text-xs"
            style={{ animation: `chip-glow 4.8s ${index * 0.8}s ease-in-out infinite` }}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function TypoVisual() {
  const typed = useTypewriter("regresion", 110);
  const done = typed === "regresion";

  return (
    <div className="w-full max-w-[240px] space-y-2">
      <div className="flex h-11 items-center rounded-xl border border-line-strong bg-surface-1 px-3 font-mono text-sm">
        <span className="caret">{typed}</span>
      </div>
      <div
        className={`flex items-center justify-between rounded-xl bg-surface-1 px-3 py-2 transition-all duration-500 ${
          done ? "opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        <span className="text-sm font-semibold text-accent-strong">regression</span>
        <span className="rounded-md bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber">
          Майже ✓
        </span>
      </div>
    </div>
  );
}

function WaveVisual() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-14 items-center gap-1">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="h-full w-1.5 origin-center rounded-full bg-gradient-to-t from-accent to-violet"
            style={{ animation: `wave 1.1s ${(index % 6) * 0.12}s ease-in-out infinite` }}
          />
        ))}
      </div>
      <p className="text-sm">
        <span className="font-semibold">deadline</span>{" "}
        <span className="font-mono text-muted">/ˈdedlaɪn/</span>
      </p>
    </div>
  );
}

function KeysVisual() {
  const keys = ["Enter", "1", "2", "3", "Z"];

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {keys.map((key, index) => (
        <kbd
          key={key}
          className="grid h-12 min-w-12 place-items-center rounded-xl border border-line-strong bg-surface-3 px-3 font-mono text-sm text-text-2"
          style={{ animation: `keypress 3.5s ${index * 0.55}s ease-in-out infinite` }}
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}

function HeatVisual() {
  const cells = Array.from({ length: 49 }, (_, index) => {
    const seed = (index * 37) % 11;
    return seed > 3;
  });

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {cells.map((isOn, index) => (
        <span
          key={index}
          className="size-5 rounded-[4px] bg-surface-4"
          style={
            isOn
              ? {
                  animation: `cell-on 400ms ${index * 35}ms ease-out forwards`,
                  opacity: 0.4 + ((index * 13) % 6) / 10,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

function ImportVisual() {
  const rows = [
    ["deadline", "дедлайн"],
    ["bottleneck", "вузьке місце"],
    ["to estimate", "оцінити"],
  ];

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface-1">
      <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-faint">
        <span>words.csv</span>
        <span className="text-accent">3 готові</span>
      </div>
      {rows.map(([en, uk], index) => (
        <div
          key={en}
          className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm last:border-0"
          style={{ animation: `slide-row 4s ${index * 0.35}s ease-out infinite` }}
        >
          <span className="font-medium">{en}</span>
          <span className="text-muted">{uk}</span>
          <Check className="size-4 text-accent" />
        </div>
      ))}
    </div>
  );
}

function PhoneNavVisual() {
  const active = useCycle(4, 1300);
  const labels = ["Практика", "Слова", "QA", "Прогрес"];

  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-surface-1 p-2">
      <div className="grid grid-cols-4">
        {labels.map((label, index) => (
          <div key={label} className="flex flex-col items-center gap-1 py-2 text-[11px]">
            <span
              className={`h-7 w-12 rounded-full transition-colors duration-300 ${
                active === index ? "bg-accent-soft" : ""
              }`}
            >
              <span
                className={`mx-auto mt-2.5 block size-2 rounded-full transition-colors ${
                  active === index ? "bg-accent" : "bg-faint"
                }`}
              />
            </span>
            <span className={active === index ? "text-text" : "text-faint"}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Curve ---------- */

export function CurveSection() {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  const width = 640;
  const height = 280;
  const top = 30;
  const bottom = 240;
  const reviews = [0, 90, 220, 400];
  const decay = [60, 120, 230, 480];
  const y = (value: number) => bottom - (bottom - top) * value;

  const segments = reviews.map((start, index) => {
    const end = reviews[index + 1] ?? width - 30;
    const points: string[] = [];
    for (let x = start; x <= end; x += 6) {
      points.push(`${x + 20},${y(Math.exp(-(x - start) / decay[index])).toFixed(1)}`);
    }
    return points.join(" ");
  });
  const naive: string[] = [];
  for (let x = 0; x <= width - 50; x += 6) {
    naive.push(`${x + 20},${y(Math.exp(-x / 60) * 0.92 + 0.08).toFixed(1)}`);
  }

  return (
    <section className="border-y border-line bg-surface-1/50">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-24 md:px-6 md:py-32 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Наука</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Крива забування — більше не вирок.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted md:text-lg md:leading-8">
            Без повторень нове знання тане за дні. Кожне вчасне пригадування
            вирівнює криву — і наступна пауза може бути довшою.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-text-2">
            {["Активне пригадування замість перечитування", "Інтервали під кожну картку", "Ціль — 90% успішних згадувань"].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent">
                  <Check className="size-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <div
          ref={ref}
          className={`rounded-3xl border border-line bg-surface-2/70 p-5 md:p-7 ${isInView ? "is-visible" : ""}`}
        >
          <svg
            aria-label="Без повторень знання згасають, з повтореннями — тримаються"
            className="h-auto w-full"
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            {[0.25, 0.5, 0.75, 1].map((level) => (
              <line key={level} stroke="var(--line)" strokeDasharray="3 6" x1="20" x2={width - 10} y1={y(level)} y2={y(level)} />
            ))}
            <polyline className="draw-path" fill="none" points={naive.join(" ")} stroke="var(--faint)" strokeDasharray="4 7" strokeWidth="2" style={{ strokeDasharray: "4 7", strokeDashoffset: 0, opacity: isInView ? 1 : 0, transition: "opacity 1s" }} />
            {segments.map((points, index) => (
              <polyline
                key={index}
                className="draw-path"
                fill="none"
                points={points}
                stroke="url(#landing-curve)"
                strokeLinecap="round"
                strokeWidth="3.5"
                style={{ transitionDelay: `${index * 450}ms` }}
              />
            ))}
            {reviews.slice(1).map((x, index) => (
              <g
                key={x}
                style={{
                  opacity: isInView ? 1 : 0,
                  transition: `opacity 400ms ${600 + index * 450}ms`,
                }}
              >
                <line stroke="var(--accent)" strokeOpacity="0.3" x1={x + 20} x2={x + 20} y1={y(1)} y2={bottom} />
                <circle cx={x + 20} cy={y(1)} fill="var(--ink)" r="7" stroke="var(--accent)" strokeWidth="3" />
              </g>
            ))}
            <defs>
              <linearGradient id="landing-curve" x1="0" x2="1">
                <stop offset="0" stopColor="var(--accent-strong)" />
                <stop offset="1" stopColor="var(--violet)" />
              </linearGradient>
            </defs>
            <text fill="var(--faint)" fontSize="13" x="20" y={height - 8}>час →</text>
            <text fill="var(--faint)" fontSize="13" x="20" y="18">пам’ять</text>
          </svg>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-6 rounded bg-gradient-to-r from-accent-strong to-violet" />з Memora
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-6 border-t-2 border-dashed border-faint" />без повторень
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-full border-[3px] border-accent" />повторення
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

const faq = [
  ["Скільки часу потрібно щодня?", "Зазвичай 5–15 хвилин. Ти сам обираєш, скільки нових карток брати на день, а Memora показує орієнтовний час на сьогоднішню чергу."],
  ["Чим це краще за звичайні флешкартки?", "Звичайні картки змушують повторювати все підряд. Memora показує кожну картку тоді, коли ти от-от її забудеш — часу йде менше, а пам’ятаєш довше."],
  ["Обов’язково писати відповідь?", "Ні. Можна згадати подумки й одразу відкрити відповідь. Але якщо напишеш — Memora порівняє й підкаже, наскільки точно вийшло."],
  ["Чи зручно на телефоні?", "Так, інтерфейс зроблено під телефон: нижня навігація, великі кнопки оцінки. Додай Memora на головний екран — і вона відкриватиметься як застосунок."],
  ["Чи можна вчити свої слова й терміни?", "Звісно. Стартові картки — лише приклад. Додавай власні вручну або імпортуй цілий список із таблиці."],
];

export function Faq() {
  return (
    <section className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-24 md:px-6 md:py-32" id="faq">
      <Reveal className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Питання</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Коротко про головне</h2>
      </Reveal>
      <div className="mt-12 space-y-3">
        {faq.map(([question, answer], index) => (
          <Reveal key={question} delay={index * 60}>
            <details className="group rounded-2xl border border-line bg-surface-2/50 px-5 transition-colors open:border-line-strong open:bg-surface-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium [&::-webkit-details-marker]:hidden">
                {question}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 transition group-open:rotate-180 group-open:bg-accent-soft group-open:text-accent">
                  <ChevronDown className="size-4" />
                </span>
              </summary>
              <p className="pb-5 pr-10 text-[15px] leading-7 text-muted">{answer}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
