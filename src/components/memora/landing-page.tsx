"use client";

import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronDown,
  Code2,
  DatabaseBackup,
  FileUp,
  Keyboard,
  Languages,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  SpellCheck,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { checkAnswer } from "@/lib/memora/answer-check";
import { AuthModal } from "./auth";
import { LogoMark, Wordmark } from "./brand";
import { Badge, buttonClass, Kbd } from "./shared-ui";
import { SpeakButton } from "./speech";

type AuthMode = "sign-in" | "sign-up";

type LandingPageProps = {
  statusMessage: string | null;
  onResetPassword: (email: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

const demoCards = [
  {
    module: "english" as const,
    prompt: "Як сказати англійською: нестабільний тест?",
    answer: "flaky test",
    example: "This flaky test fails only in CI.",
    speak: "flaky test",
  },
  {
    module: "qa" as const,
    prompt: "Яка техніка тест-дизайну перевіряє значення на межах діапазонів?",
    answer: "Boundary value analysis",
    example: "Для поля 1–100 перевіряємо 0, 1, 100 і 101.",
    speak: "",
  },
  {
    module: "english" as const,
    prompt: "Що українською означає «to deploy»?",
    answer: "розгорнути, викотити реліз",
    example: "We deploy to production every Friday.",
    speak: "to deploy",
  },
];

const steps = [
  {
    icon: FileUp,
    title: "Додай, що хочеш запам’ятати",
    text: "Слово, фразу чи QA-термін — вручну за 10 секунд або списком через CSV. Memora сама зробить картки в обидва боки.",
  },
  {
    icon: BrainCircuit,
    title: "Згадай без підказки",
    text: "Спершу формулюєш відповідь сам — письмово чи подумки. Саме це зусилля й закріплює знання.",
  },
  {
    icon: CalendarClock,
    title: "Повернись саме вчасно",
    text: "Алгоритм FSRS рахує, коли ти почнеш забувати, і показує картку саме тоді. Легке — рідше, складне — частіше.",
  },
];

const features = [
  {
    icon: CalendarClock,
    title: "Розумний розклад",
    text: "FSRS — сучасний алгоритм інтервальних повторень, той самий, що в Anki.",
  },
  {
    icon: SpellCheck,
    title: "Перевірка відповіді",
    text: "Пробачає регістр, артиклі й дрібні описки, а синоніми через кому теж зараховує.",
  },
  {
    icon: Volume2,
    title: "Вимова слів",
    text: "Прослухай слово чи приклад англійською одним дотиком.",
  },
  {
    icon: Keyboard,
    title: "Швидко з клавіатури",
    text: "Enter — перевірити, 1–4 — оцінити, Z — скасувати. Десять карток за хвилину.",
  },
  {
    icon: BarChart3,
    title: "Прогрес і серії",
    text: "Календар активності, прогноз повторень і слабкі місця, які варто підтягнути.",
  },
  {
    icon: DatabaseBackup,
    title: "Твої дані — твої",
    text: "Імпорт і експорт CSV, повна резервна копія в один клік.",
  },
];

const faq = [
  {
    question: "Скільки часу потрібно щодня?",
    answer:
      "Зазвичай 5–15 хвилин. Ти сам обираєш, скільки нових карток додавати на день, а Memora показує орієнтовний час на сьогоднішню чергу.",
  },
  {
    question: "Чим це краще за звичайні флешкартки?",
    answer:
      "Звичайні картки змушують повторювати все підряд. Memora показує кожну картку тоді, коли ти от-от її забудеш, — тож часу йде менше, а пам’ятаєш довше.",
  },
  {
    question: "Чи зручно на телефоні?",
    answer:
      "Так. Інтерфейс зроблено для телефона з першого дня: нижня навігація, великі кнопки оцінки. Додай Memora на головний екран — і вона відкриватиметься як застосунок.",
  },
  {
    question: "Чи можна вчити свої слова й терміни?",
    answer:
      "Звісно. Стартові картки — лише приклад. Додавай власні матеріали вручну або імпортуй цілий список із таблиці.",
  },
  {
    question: "Обов’язково писати відповідь?",
    answer:
      "Ні. Можна згадати подумки й одразу відкрити відповідь. Але якщо напишеш — Memora порівняє й підкаже, наскільки точно вийшло.",
  },
];

export function LandingPage({
  statusMessage,
  onResetPassword,
  onSignIn,
  onSignUp,
}: LandingPageProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("sign-up");
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setIsAuthOpen(true);
  }

  return (
    <div className="min-h-svh overflow-x-clip bg-ink text-text">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-ink/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <a aria-label="Memora — на початок" href="#top">
            <Wordmark />
          </a>

          <nav
            aria-label="Навігація"
            className="hidden items-center gap-8 text-sm text-muted md:flex"
          >
            <a className="transition hover:text-text" href="#how">
              Як це працює
            </a>
            <a className="transition hover:text-text" href="#features">
              Можливості
            </a>
            <a className="transition hover:text-text" href="#faq">
              Питання
            </a>
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              className={buttonClass("ghost", "sm")}
              onClick={() => openAuth("sign-in")}
              type="button"
            >
              Увійти
            </button>
            <button
              className={buttonClass("primary", "sm")}
              onClick={() => openAuth("sign-up")}
              type="button"
            >
              Почати
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate pt-16" id="top">
          <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div aria-hidden="true" className="glow-accent absolute inset-0 -z-10" />

          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2/70 px-3 py-1 text-xs font-medium text-text-2">
                <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                Англійська · QA · інтервальні повторення
              </p>
              <h1 className="mt-6 text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[68px]">
                Не перечитуй.
                <br />
                <span className="text-gradient">Згадуй.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-text-2">
                Memora тренує пам’ять так, як вона працює насправді: спершу ти
                згадуєш відповідь сам, а розумний розклад повертає картку саме
                тоді, коли вона почне забуватися.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  className={buttonClass("primary", "lg", "sm:px-6")}
                  onClick={() => openAuth("sign-up")}
                  type="button"
                >
                  Почати навчання
                  <ArrowRight className="size-4" />
                </button>
                <a className={buttonClass("secondary", "lg")} href="#demo">
                  Спробувати картку
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                {["5–15 хвилин на день", "Телефон і комп’ютер", "Твої матеріали — тільки твої"].map(
                  (item) => (
                    <li key={item} className="inline-flex items-center gap-2">
                      <Check className="size-4 text-accent" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="animate-rise delay-2 scroll-mt-24" id="demo">
              <DemoCard />
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface-1/60">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow>Чому це працює</Eyebrow>
              <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight md:text-[42px]">
                Пам’ять згасає за кривою. Ми повторюємо на її зламі.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted">
                Без повторень більшість нового забувається за кілька днів. Кожне
                вдале пригадування робить слід міцнішим — і наступна пауза може
                бути довшою. Memora розраховує ці паузи для кожної картки окремо.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-3">
                <Stat value="FSRS" label="розклад для кожної картки" />
                <Stat value="90%" label="цільовий рівень згадувань" />
                <Stat value="5–15 хв" label="на день вистачає" />
              </div>
            </div>
            <ForgettingCurve />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24" id="how">
          <Eyebrow>Як це працює</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-[42px]">
            Три кроки. Щодня. Без хаосу в нотатках.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="group relative rounded-3xl border border-line bg-surface-2/60 p-6 transition hover:border-line-strong"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                    <step.icon className="size-5" />
                  </span>
                  <span className="font-mono text-sm text-faint">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
          <div className="grid gap-4 lg:grid-cols-2">
            <DirectionCard
              icon={Languages}
              tone="green"
              title="Англійські слова"
              text="Активний словник для роботи й життя: переклад в обидва боки, приклади в контексті, вимова."
              sample={{ prompt: "Як сказати англійською: дедлайн зсувається?", answer: "the deadline slips" }}
            />
            <DirectionCard
              icon={Code2}
              tone="violet"
              title="QA та тестування"
              text="Терміни, техніки тест-дизайну й питання зі співбесід — пояснюєш своїми словами, а не зубриш."
              sample={{ prompt: "Чим retest відрізняється від regression?", answer: "Retest перевіряє фікс, regression — що нічого не зламалось" }}
            />
          </div>
        </section>

        <section className="border-y border-line bg-surface-1/60 scroll-mt-16" id="features">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <Eyebrow>Можливості</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-[42px]">
              Усе для щоденної практики. Нічого зайвого.
            </h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="bg-surface-2 p-6">
                  <feature.icon className="size-5 text-accent" />
                  <h3 className="mt-4 font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{feature.text}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-line bg-surface-2/60 p-6 sm:flex-row sm:items-center">
              <Smartphone className="size-6 shrink-0 text-violet" />
              <p className="text-sm leading-6 text-text-2">
                <span className="font-semibold text-text">Зручно в дорозі.</span>{" "}
                Відкрий Memora на телефоні й додай на головний екран — практика
                запускатиметься як окремий застосунок.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24" id="faq">
          <Eyebrow>Питання</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-[42px]">
            Часті питання
          </h2>
          <div className="mt-10 divide-y divide-line border-y border-line">
            {faq.map((item) => (
              <details key={item.question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-medium [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown className="size-5 shrink-0 text-muted transition group-open:rotate-180" />
                </summary>
                <p className="pb-5 pr-8 text-sm leading-7 text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6 md:pb-28">
          <div className="glow-accent relative overflow-hidden rounded-[32px] border border-line-strong bg-surface-2 px-6 py-14 text-center md:py-20">
            <LogoMark className="mx-auto size-12" />
            <h2 className="mx-auto mt-6 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              Перша сесія займе п’ять хвилин.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted">
              Стартові картки вже готові — створи акаунт і пройди їх просто зараз.
            </p>
            <button
              className={buttonClass("primary", "lg", "mt-8 sm:px-7")}
              onClick={() => openAuth("sign-up")}
              type="button"
            >
              Почати навчання
              <ArrowRight className="size-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:justify-between md:px-6">
          <Wordmark markClassName="size-6" />
          <p className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Твої матеріали бачиш лише ти.
          </p>
        </div>
      </footer>

      {isAuthOpen ? (
        <AuthModal
          initialMode={authMode}
          statusMessage={statusMessage}
          onClose={() => setIsAuthOpen(false)}
          onResetPassword={onResetPassword}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
        />
      ) : null}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">
      {children}
    </p>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/70 p-3 sm:p-4">
      <p className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-4 text-muted">{label}</p>
    </div>
  );
}

function DemoCard() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const card = demoCards[index % demoCards.length];
  const check = isRevealed ? checkAnswer(typed, card.answer) : null;

  function next() {
    setDone((value) => value + 1);
    setIndex((value) => value + 1);
    setTyped("");
    setIsRevealed(false);
  }

  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-accent/20 via-transparent to-violet/20 blur-2xl" />
      <div className="mb-3 flex items-center gap-3 px-1">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-violet transition-[width] duration-500"
            style={{ width: `${((done % demoCards.length) / demoCards.length) * 100 + 8}%` }}
          />
        </div>
        <span className="font-mono text-xs text-muted">демо</span>
      </div>

      <article
        key={index}
        className="animate-card overflow-hidden rounded-3xl border border-line-strong bg-gradient-to-b from-surface-3 to-surface-2 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center gap-1.5 px-5 pt-5">
          <Badge tone={card.module === "english" ? "green" : "violet"}>
            {card.module === "english" ? "Англійська" : "QA"}
          </Badge>
          <Badge tone="violet">Нова</Badge>
        </div>
        <div className="px-6 pb-6 pt-6 text-center">
          <h3 className="text-balance text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            {card.prompt}
          </h3>
        </div>

        {!isRevealed ? (
          <form
            className="border-t border-line/70 bg-surface-1/40 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              setIsRevealed(true);
            }}
          >
            <label className="sr-only" htmlFor="demo-answer">
              Твоя відповідь
            </label>
            <input
              autoCapitalize="off"
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-line-strong bg-surface-1 px-4 text-base outline-none transition placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/15"
              id="demo-answer"
              placeholder="Спробуй відповісти"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
            <button className={buttonClass("primary", "lg", "mt-3 w-full")} type="submit">
              {typed.trim() ? "Перевірити" : "Показати відповідь"}
              <Kbd>Enter</Kbd>
            </button>
          </form>
        ) : (
          <div className="animate-reveal border-t border-line/70 bg-surface-1/40 px-6 py-5">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-2xl font-semibold leading-snug tracking-tight text-accent-strong">
                {card.answer}
              </p>
              {card.speak ? <SpeakButton text={card.speak} /> : null}
            </div>
            {check && check.verdict !== "empty" ? (
              <p
                className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${
                  check.verdict === "exact"
                    ? "bg-accent-soft text-accent"
                    : check.verdict === "close"
                      ? "bg-amber-soft text-amber"
                      : check.verdict === "self"
                        ? "bg-surface-4 text-text-2"
                        : "bg-danger-soft text-danger"
                }`}
              >
                {check.verdict === "exact"
                  ? "Точно!"
                  : check.verdict === "close"
                    ? "Майже — є описка"
                    : check.verdict === "self"
                      ? "Порівняй за змістом"
                      : "Не збігається"}
              </p>
            ) : null}
            <p className="mt-3 text-sm italic leading-6 text-text-2">{card.example}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                className="flex h-14 flex-col items-center justify-center rounded-2xl border border-danger/25 bg-danger-soft text-[#ffb4aa] transition hover:border-danger/60"
                onClick={next}
                type="button"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <RotateCcw className="size-3.5" />
                  Не згадав
                </span>
                <span className="font-mono text-[11px] opacity-75">10 хв</span>
              </button>
              <button
                className="flex h-14 flex-col items-center justify-center rounded-2xl border border-accent bg-accent text-accent-ink transition hover:bg-accent-strong"
                onClick={next}
                type="button"
              >
                <span className="text-sm font-semibold">Згадав</span>
                <span className="font-mono text-[11px] opacity-75">3 дн</span>
              </button>
            </div>
          </div>
        )}
      </article>
      <p className="mt-3 text-center text-xs text-faint">
        Інтервал під кнопкою — коли картка повернеться.
      </p>
    </div>
  );
}

function ForgettingCurve() {
  // Retention decays, each review resets it higher and the decay slows down.
  const reviews = [0, 70, 175, 330];
  const width = 520;
  const height = 260;
  const decay = [55, 110, 210, 420];
  const top = 30;
  const bottom = 220;

  function y(retention: number) {
    return bottom - (bottom - top) * retention;
  }

  const segments = reviews.map((start, index) => {
    const end = reviews[index + 1] ?? width - 20;
    const points: string[] = [];
    for (let x = start; x <= end; x += 6) {
      const retention = Math.exp(-(x - start) / decay[index]);
      points.push(`${x + 20},${y(retention).toFixed(1)}`);
    }
    return points.join(" ");
  });

  const naive: string[] = [];
  for (let x = 0; x <= width - 40; x += 6) {
    naive.push(`${x + 20},${y(Math.exp(-x / 55) * 0.92 + 0.08 * Math.exp(-x / 900)).toFixed(1)}`);
  }

  return (
    <figure className="rounded-3xl border border-line bg-surface-2/70 p-5 md:p-6">
      <svg
        aria-label="Крива забування: без повторень знання швидко згасають, з повтореннями — тримаються"
        className="h-auto w-full"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <line
            key={level}
            stroke="var(--line)"
            strokeDasharray="3 5"
            x1="20"
            x2={width - 20}
            y1={y(level)}
            y2={y(level)}
          />
        ))}
        <polyline
          fill="none"
          points={naive.join(" ")}
          stroke="var(--faint)"
          strokeDasharray="4 6"
          strokeWidth="2"
        />
        {segments.map((points, index) => (
          <polyline
            key={index}
            fill="none"
            points={points}
            stroke="url(#curve)"
            strokeLinecap="round"
            strokeWidth="3"
          />
        ))}
        {reviews.slice(1).map((x) => (
          <g key={x}>
            <line stroke="var(--accent)" strokeOpacity="0.35" x1={x + 20} x2={x + 20} y1={y(1)} y2={bottom} />
            <circle cx={x + 20} cy={y(1)} fill="var(--ink)" r="6" stroke="var(--accent)" strokeWidth="2.5" />
          </g>
        ))}
        <defs>
          <linearGradient id="curve" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--accent-strong)" />
            <stop offset="1" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
        <text fill="var(--faint)" fontSize="12" x="20" y={height - 10}>
          час →
        </text>
        <text fill="var(--faint)" fontSize="12" x="20" y="18">
          пам’ять
        </text>
      </svg>
      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-gradient-to-r from-accent-strong to-violet" />
          з повтореннями Memora
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0 w-5 border-t-2 border-dashed border-faint" />
          без повторень
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full border-2 border-accent" />
          повторення
        </span>
      </figcaption>
    </figure>
  );
}

function DirectionCard({
  icon: Icon,
  sample,
  text,
  title,
  tone,
}: {
  icon: typeof Languages;
  sample: { prompt: string; answer: string };
  text: string;
  title: string;
  tone: "green" | "violet";
}) {
  return (
    <article className="flex flex-col rounded-3xl border border-line bg-surface-2/60 p-6 md:p-8">
      <span
        className={`grid size-11 place-items-center rounded-2xl ${
          tone === "green" ? "bg-accent-soft text-accent" : "bg-violet-soft text-violet"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <h3 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{text}</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface-1 p-4">
        <p className="text-sm font-medium text-text">{sample.prompt}</p>
        <p
          className={`mt-2 text-sm font-semibold ${tone === "green" ? "text-accent" : "text-violet"}`}
        >
          {sample.answer}
        </p>
      </div>
    </article>
  );
}
