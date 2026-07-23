"use client";

import Image from "next/image";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CalendarClock,
  Check,
  ChevronRight,
  Code2,
  DatabaseBackup,
  FileUp,
  Languages,
  LockKeyhole,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { AuthModal } from "./auth";

type AuthMode = "sign-in" | "sign-up";

type LandingPageProps = {
  errorMessage: string | null;
  statusMessage: string | null;
  onResetPassword: (email: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
};

const learningSteps = [
  {
    icon: FileUp,
    number: "01",
    title: "Додаєш матеріал",
    text: "Слова, фрази й QA-терміни можна внести вручну або завантажити через CSV.",
  },
  {
    icon: Brain,
    number: "02",
    title: "Згадуєш з пам’яті",
    text: "Не перечитуєш готову відповідь, а спочатку формулюєш її самостійно.",
  },
  {
    icon: CalendarClock,
    number: "03",
    title: "Повертаєшся вчасно",
    text: "Memora планує наступне повторення тоді, коли знання ще можна втримати.",
  },
] as const;

const directionItems = [
  {
    icon: Languages,
    title: "Англійські слова",
    text: "Власний словник із прикладами, перекладом і вправами на активне пригадування.",
    points: ["слова й фрази", "приклади в контексті", "практика українською"],
  },
  {
    icon: Code2,
    title: "QA та тестування",
    text: "Терміни й пояснення для співбесід, робочої підготовки та професійної англійської.",
    points: ["QA-терміни", "короткі визначення", "питання для співбесіди"],
  },
] as const;

const featureItems = [
  {
    icon: Target,
    title: "Практика без зайвого шуму",
    text: "На головному екрані залишається тільки те, що треба пройти зараз.",
  },
  {
    icon: BookOpenCheck,
    title: "Контроль матеріалів",
    text: "Редагування, пауза й повне видалення працюють на рівні матеріалу.",
  },
  {
    icon: DatabaseBackup,
    title: "Резервна копія",
    text: "Дані можна експортувати й відновити, щоб не втратити особисту базу знань.",
  },
  {
    icon: LockKeyhole,
    title: "Особистий простір",
    text: "Кабінет прив’язаний до твого акаунта й синхронізується через Supabase.",
  },
] as const;

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
    <main className="min-h-screen overflow-x-hidden bg-[#070a0f] pt-16 text-[#eef4ff]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070a0f]/62 shadow-[0_18px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-4 md:px-6">
          <a
            className="group flex items-center gap-3 font-semibold"
            href="#top"
            aria-label="Memora — на початок сторінки"
          >
            <Brain
              className="size-7 text-[#eef4ff] transition group-hover:text-[#52e0c4]"
              strokeWidth={1.8}
            />
            <span className="text-lg">Memora</span>
          </a>

          <nav
            className="hidden items-center gap-7 text-sm text-[#b4c0cf] md:flex"
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
              className="hidden min-h-10 rounded-lg px-3 text-sm font-medium text-[#c7d0dd] transition hover:text-[#52e0c4] sm:inline-flex sm:items-center"
              onClick={() => openAuth("sign-in")}
              type="button"
            >
              Увійти
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#2dd4bf] px-4 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4]"
              onClick={() => openAuth("sign-up")}
              type="button"
            >
              Почати
            </button>
          </div>
        </div>
      </header>

      <section
        className="relative isolate min-h-[76svh] overflow-hidden border-b border-[#202938]"
        id="top"
      >
        <Image
          className="object-cover opacity-[0.66]"
          src="/landing-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#070a0f]/48" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#070a0f_0%,rgba(7,10,15,0.9)_31%,rgba(7,10,15,0.35)_70%,rgba(7,10,15,0.82)_100%)]" />

        <div className="relative mx-auto flex min-h-[76svh] w-full max-w-[1240px] items-center px-4 py-14 md:px-6">
          <div className="landing-reveal max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#52e0c4]">
              <Sparkles className="size-4" />
              Англійська й QA в одному навчальному ритмі
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-none md:text-7xl">
              Memora
            </h1>
            <p className="mt-5 max-w-2xl text-2xl font-semibold leading-tight text-[#eef4ff] md:text-5xl">
              Згадуй, перевіряй, запам’ятовуй надовго.
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#c7d0dd]">
              Memora допомагає вчити англійські слова й QA-терміни через
              активне пригадування та повторення в правильний момент.
            </p>
            <div className="mt-7 grid max-w-lg grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-2 sm:flex sm:max-w-none sm:gap-3">
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-5 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4]"
                onClick={() => openAuth("sign-up")}
                type="button"
              >
                Почати навчання
                <ArrowRight className="size-4" />
              </button>
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/18 bg-[#10161f]/58 px-5 py-3 text-sm font-medium text-[#eef4ff] backdrop-blur-md transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
                href="#how-it-works"
              >
                Як це працює
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-start"
        id="how-it-works"
      >
        <SectionHeading
          eyebrow="Як працює"
          title="Три кроки замість нескінченного перечитування."
          description="Сервіс не змушує тримати в голові весь список матеріалів. Він показує тільки те, що варто згадати сьогодні."
        />

        <div className="space-y-3">
          {learningSteps.map((step) => (
            <ProcessStep key={step.number} {...step} />
          ))}
        </div>
      </section>

      <section className="border-y border-[#202938] bg-[#0b1017]" id="directions">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-14 md:px-6 md:py-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              eyebrow="Напрями"
              title="Один простір для мови й професійних знань."
              description="Можна практикувати все разом або окремо сфокусуватися на словах чи QA-підготовці."
            />
            <div className="hidden max-w-xs border-l border-[#263140] pl-5 text-sm leading-6 text-[#9aa8ba] md:block">
              Український інтерфейс, англійські терміни там, де вони природні,
              і пояснення без технічного шуму.
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {directionItems.map((item) => (
              <DirectionPanel key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[0.9fr_1.1fr]"
        id="features"
      >
        <div>
          <SectionHeading
            eyebrow="Можливості"
            title="Повноцінний кабінет, але без перевантаження."
            description="Всередині є практика, матеріали, прогрес, профіль, імпорт, резервні копії й довідка. На кожному екрані лишається своя задача."
          />
          <button
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-5 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] sm:w-auto"
            onClick={() => openAuth("sign-up")}
            type="button"
          >
            Створити акаунт
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="divide-y divide-[#263140] border-y border-[#263140]">
          {featureItems.map((item) => (
            <FeatureRow key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="border-y border-[#202938] bg-[#0b1017]">
        <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.75fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[#52e0c4]">Що в результаті</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
              Менше хаосу в матеріалах. Більше регулярного пригадування.
            </h2>
          </div>
          <div className="grid gap-3 text-sm text-[#c7d0dd] sm:grid-cols-3 lg:grid-cols-1">
            <OutcomeItem text="Слова не губляться в нотатках." />
            <OutcomeItem text="QA-терміни повторюються системно." />
            <OutcomeItem text="День навчання починається з готової черги." />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-14 md:px-6 md:py-20">
        <div className="flex flex-col items-start justify-between gap-7 border-y border-[#263140] py-10 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold text-[#52e0c4]">
              Готовий спробувати
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
            Почати навчання
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
}: (typeof learningSteps)[number]) {
  return (
    <article className="group grid gap-4 border-l border-[#263140] py-3 pl-5 sm:grid-cols-[76px_1fr] sm:items-start sm:border-l-0 sm:border-t sm:pl-0 sm:pt-5">
      <div className="flex items-center gap-3 sm:block">
        <span className="font-mono text-xs text-[#6f7d90]">{number}</span>
        <span className="grid size-10 place-items-center rounded-lg border border-[#263140] bg-[#10161f] text-[#52e0c4] transition group-hover:border-[#2dd4bf]">
          <Icon className="size-5" />
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9aa8ba]">{text}</p>
      </div>
    </article>
  );
}

function DirectionPanel({
  icon: Icon,
  title,
  text,
  points,
}: (typeof directionItems)[number]) {
  return (
    <article className="rounded-lg border border-[#263140] bg-[#10161f] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.26)] md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Icon className="size-6 text-[#52e0c4]" />
          <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
        </div>
        <span className="rounded-full border border-[#2dd4bf]/30 px-3 py-1 text-xs font-medium text-[#52e0c4]">
          Фокус
        </span>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#9aa8ba]">{text}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {points.map((point) => (
          <span
            className="rounded-md border border-[#263140] bg-[#0b111a] px-3 py-2 text-sm text-[#c7d0dd]"
            key={point}
          >
            {point}
          </span>
        ))}
      </div>
    </article>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  text,
}: (typeof featureItems)[number]) {
  return (
    <article className="grid gap-3 py-5 sm:grid-cols-[40px_190px_1fr] sm:items-start">
      <Icon className="size-5 text-[#52e0c4]" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm leading-6 text-[#9aa8ba]">{text}</p>
    </article>
  );
}

function OutcomeItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#263140] bg-[#10161f] p-4">
      <Check className="mt-0.5 size-4 shrink-0 text-[#52e0c4]" />
      <span className="leading-6">{text}</span>
    </div>
  );
}
