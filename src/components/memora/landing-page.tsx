"use client";

import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  Check,
  Clock3,
  Code2,
  FileUp,
  Gauge,
  Languages,
  ListChecks,
  Plus,
  Target,
} from "lucide-react";
import { useState } from "react";
import type { StudyMode } from "@/lib/memora/types";
import { AuthModal } from "./auth";
import { Metric, ModeSelector, ShellPanel } from "./shared-ui";

type AuthMode = "sign-in" | "sign-up";

type LandingPageProps = {
  errorMessage: string | null;
  statusMessage: string | null;
  onResetPassword: (email: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

const previewContent: Record<
  StudyMode,
  {
    prompt: string;
    answer: string;
    queue: string;
    newCards: string;
    time: string;
  }
> = {
  daily: {
    prompt: "Поясни українською: що таке Regression testing?",
    answer:
      "Перевірка, що вже працюючий функціонал не зламався після змін.",
    queue: "4",
    newCards: "6",
    time: "10 хв",
  },
  "english-productive": {
    prompt: "Як англійською назвати передачу контексту іншій людині?",
    answer: "handoff",
    queue: "2",
    newCards: "4",
    time: "7 хв",
  },
  "qa-interview": {
    prompt: "У чому різниця між severity і priority?",
    answer:
      "Severity описує вплив дефекту, а priority — терміновість виправлення.",
    queue: "3",
    newCards: "2",
    time: "8 хв",
  },
};

export function LandingPage({
  errorMessage,
  statusMessage,
  onResetPassword,
  onSignIn,
  onSignUp,
}: LandingPageProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setIsAuthOpen(true);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#070a0f] text-[#eef4ff]">
      <header className="sticky top-0 z-40 border-b border-[#202938] bg-[#070a0f]/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-4 md:px-6">
          <a
            className="flex items-center gap-3 font-semibold"
            href="#top"
            aria-label="Memora — на початок сторінки"
          >
            <Brain className="size-7 text-[#eef4ff]" strokeWidth={1.8} />
            <span className="text-lg">Memora</span>
          </a>

          <nav
            className="hidden items-center gap-7 text-sm text-[#9aa8ba] md:flex"
            aria-label="Навігація лендингу"
          >
            <a className="transition hover:text-[#eef4ff]" href="#how-it-works">
              Як працює
            </a>
            <a className="transition hover:text-[#eef4ff]" href="#directions">
              Напрями
            </a>
            <a className="transition hover:text-[#eef4ff]" href="#features">
              Можливості
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:text-[#52e0c4] sm:inline-flex"
              onClick={() => openAuth("sign-in")}
              type="button"
            >
              Увійти
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-[#2dd4bf] px-4 py-2 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4]"
              onClick={() => openAuth("sign-up")}
              type="button"
            >
              Почати
            </button>
          </div>
        </div>
      </header>

      <section
        className="relative mx-auto w-full max-w-[1240px] px-4 pb-6 pt-10 md:px-6 md:pb-12 md:pt-14"
        id="top"
      >
        <div className="landing-reveal mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-[#52e0c4]">
            Англійська й QA в одному ритмі
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-none md:text-7xl">
            Memora
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-2xl font-semibold leading-tight text-[#eef4ff] md:text-4xl">
            Запам&apos;ятовуй слова й терміни надовго.
          </p>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#9aa8ba]">
            Коротка практика щодня: спочатку згадуєш, потім перевіряєш
            себе, а Memora планує наступне повторення.
          </p>
          <div className="mx-auto mt-7 grid max-w-lg grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-2 sm:flex sm:max-w-none sm:justify-center sm:gap-3">
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-5 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4]"
              onClick={() => openAuth("sign-up")}
              type="button"
            >
              Почати навчання
              <ArrowRight className="size-4" />
            </button>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#263140] px-5 py-3 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
              href="#how-it-works"
            >
              Як працює
            </a>
          </div>
        </div>

        <LandingProductPreview />
      </section>

      <section
        className="border-y border-[#202938] bg-[#0b1017]"
        id="how-it-works"
      >
        <div className="mx-auto w-full max-w-[1240px] px-4 py-10 md:px-6 md:py-20">
          <SectionHeading
            eyebrow="Як працює"
            title="Три кроки замість нескінченного перечитування."
            description="Memora перетворює матеріал на коротку практику й повертає його саме тоді, коли пам’ять починає слабшати."
          />

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <ProcessStep
              icon={Plus}
              number="01"
              title="Додай матеріал"
              text="Запиши слово чи QA-термін вручну або завантаж підготовлений CSV."
            />
            <ProcessStep
              icon={Brain}
              number="02"
              title="Згадай сам"
              text="Сформулюй відповідь із пам’яті, а вже потім відкрий правильний варіант."
            />
            <ProcessStep
              icon={Clock3}
              number="03"
              title="Повтори вчасно"
              text="Оціни, наскільки легко згадав. Memora сама визначить наступну дату."
            />
          </div>
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-[1240px] px-4 py-16 md:px-6 md:py-20"
        id="directions"
      >
        <SectionHeading
          eyebrow="Два напрями"
          title="Один простір для мови й професійних знань."
          description="Практикуй усе разом або перемикайся на конкретний напрям, коли потрібен окремий фокус."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <DirectionPanel
            icon={Languages}
            title="Англійські слова"
            text="Слово, українське значення й живий приклад перетворюються на вправи для активного пригадування."
            items={[
              "переклад з української",
              "пригадування в контексті",
              "власний словник без зайвих списків",
            ]}
          />
          <DirectionPanel
            icon={Code2}
            title="QA та тестування"
            text="Терміни, техніки й сценарії залишаються англійською, а пояснення — зрозумілою українською."
            items={[
              "підготовка до співбесіди",
              "пояснення термінів своїми словами",
              "практичні приклади з тестування",
            ]}
          />
        </div>
      </section>

      <section className="border-y border-[#202938] bg-[#0b1017]" id="features">
        <div className="mx-auto grid w-full max-w-[1240px] gap-12 px-4 py-16 md:px-6 md:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionHeading
            eyebrow="Можливості"
            title="Усе потрібне для регулярної практики."
            description="Без декоративних рейтингів і складних налаштувань на головному екрані."
          />

          <div className="divide-y divide-[#263140] border-y border-[#263140]">
            <FeatureRow
              icon={Target}
              title="Черга на сьогодні"
              text="Повторення, нові картки й орієнтовний час зібрані в одному робочому екрані."
            />
            <FeatureRow
              icon={BookOpenCheck}
              title="Контроль матеріалів"
              text="Редагуй, став на паузу або повністю видаляй слова й терміни разом із картками."
            />
            <FeatureRow
              icon={FileUp}
              title="Імпорт і резервна копія"
              text="Додавай матеріали через CSV та зберігай повну копію своєї бази знань."
            />
            <FeatureRow
              icon={Gauge}
              title="Прогрес без шуму"
              text="Дивись динаміку навчання, останні повторення й картки, яким потрібна увага."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-16 md:px-6 md:py-24">
        <div className="flex flex-col items-start justify-between gap-7 border-y border-[#263140] py-10 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold text-[#52e0c4]">
              Наступний крок
            </p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">
              Відкрий Memora й пройди першу коротку практику.
            </h2>
          </div>
          <button
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-5 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] md:w-auto"
            onClick={() => openAuth("sign-up")}
            type="button"
          >
            Створити акаунт
            <ArrowRight className="size-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-[#202938]">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 py-7 text-sm text-[#6f7d90] sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="flex items-center gap-2 text-[#c7d0dd]">
            <Brain className="size-5" strokeWidth={1.8} />
            <span className="font-semibold">Memora</span>
          </div>
          <p>Простір для навчання.</p>
        </div>
      </footer>

      {isAuthOpen ? (
        <AuthModal
          errorMessage={errorMessage}
          initialMode={authMode}
          statusMessage={statusMessage}
          onClose={() => setIsAuthOpen(false)}
          onResetPassword={onResetPassword}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
        />
      ) : null}
    </main>
  );
}

function LandingProductPreview() {
  const [mode, setMode] = useState<StudyMode>("daily");
  const [answer, setAnswer] = useState("");
  const [isChecked, setIsChecked] = useState(false);
  const content = previewContent[mode];

  function changeMode(nextMode: StudyMode) {
    setMode(nextMode);
    setAnswer("");
    setIsChecked(false);
  }

  return (
    <div className="landing-reveal landing-reveal-delay mx-auto mt-8 w-full max-w-6xl md:mt-10">
      <div className="hidden grid-cols-5 gap-3 lg:grid">
        <Metric
          icon={ListChecks}
          label="Повторити"
          value={content.queue}
          accent="bg-[#2dd4bf]"
        />
        <Metric
          icon={Plus}
          label="Нові"
          value={content.newCards}
          accent="bg-[#8b7cf6]"
        />
        <Metric
          icon={Clock3}
          label="Час"
          value={content.time}
          accent="bg-[#f2a84a]"
        />
        <Metric
          icon={Gauge}
          label="Якість"
          value="91%"
          accent="bg-[#ef6351]"
          className="hidden md:block"
        />
        <Metric
          icon={Check}
          label="Закріплені"
          value="18"
          accent="bg-[#202938]"
          className="hidden md:block"
        />
      </div>

      <ModeSelector className="mt-3" value={mode} onChange={changeMode} />

      <ShellPanel className="mt-3 overflow-hidden p-4 md:p-5">
        <div
          className="grid h-2 w-full grid-cols-6 gap-1"
          aria-label="Демонстраційний прогрес практики"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              className={`rounded-full ${
                index === 0 ? "bg-[#2dd4bf]" : "bg-[#182230]"
              }`}
              key={index}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-[#9aa8ba]">Питання</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
              {content.prompt}
            </h2>
          </div>

          <div>
            <label className="block">
              <span className="text-sm font-medium text-[#9aa8ba]">
                Відповідь
              </span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-4 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  setIsChecked(false);
                }}
                placeholder="Напиши з пам’яті"
              />
            </label>
            <button
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
              disabled={!answer.trim()}
              onClick={() => setIsChecked(true)}
              type="button"
            >
              Перевірити
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        {isChecked ? (
          <div className="mt-4 border-t border-[#263140] pt-4">
            <p className="text-sm font-medium text-[#52e0c4]">
              Правильна відповідь
            </p>
            <p className="mt-2 text-base font-semibold leading-6">
              {content.answer}
            </p>
          </div>
        ) : null}
      </ShellPanel>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-[#52e0c4]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-[#9aa8ba]">{description}</p>
    </div>
  );
}

function ProcessStep({
  icon: Icon,
  number,
  title,
  text,
}: {
  icon: typeof Plus;
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-lg border border-[#263140] bg-[#10161f] p-5">
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-[#52e0c4]" />
        <span className="font-mono text-xs text-[#6f7d90]">{number}</span>
      </div>
      <h3 className="mt-7 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#9aa8ba]">{text}</p>
    </article>
  );
}

function DirectionPanel({
  icon: Icon,
  title,
  text,
  items,
}: {
  icon: typeof Languages;
  title: string;
  text: string;
  items: string[];
}) {
  return (
    <article className="rounded-lg border border-[#263140] bg-[#0d131c] p-5 md:p-6">
      <Icon className="size-6 text-[#52e0c4]" />
      <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#9aa8ba]">{text}</p>
      <ul className="mt-6 space-y-3 border-t border-[#263140] pt-5">
        {items.map((item) => (
          <li className="flex items-start gap-3 text-sm text-[#c7d0dd]" key={item}>
            <Check className="mt-0.5 size-4 shrink-0 text-[#52e0c4]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Target;
  title: string;
  text: string;
}) {
  return (
    <article className="grid gap-3 py-5 sm:grid-cols-[40px_180px_1fr] sm:items-start">
      <Icon className="size-5 text-[#52e0c4]" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm leading-6 text-[#9aa8ba]">{text}</p>
    </article>
  );
}
