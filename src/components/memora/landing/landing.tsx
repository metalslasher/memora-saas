import {
  ArrowRight,
  Bell,
  Check,
  ExternalLink,
  Eye,
  Flame,
  Headphones,
  Mic,
  MessageSquareText,
  PenLine,
  Plus,
  Share2,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Sparkles,
  TextCursorInput,
} from "lucide-react";
import { formatInterval } from "@/lib/memora/scheduler";
import { LogoMark, Wordmark } from "../brand";
import { AuthButton, AuthRoot } from "./auth-island";
import { DemoCard } from "./demo-card";
import { PlayClip } from "./play-clip";
import { RetentionChart, reviewGaps } from "./retention-chart";

/**
 * The landing page. Server-rendered and static; the interactive islands are
 * the demo card, two audio buttons and sign-in. Every claim here describes
 * what the app does today (docs/product.md).
 */
export function Landing() {
  return (
    <div className="min-h-svh overflow-x-clip bg-ink text-text">
      <NavBar />
      <main id="top">
        <Hero />
        <Principles />
        <HowItWorks />
        <Exercises />
        <WordSources />
        <Habit />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <AuthRoot />
    </div>
  );
}

const sources = {
  testing: {
    label: "Roediger & Karpicke, 2006",
    href: "https://doi.org/10.1111/j.1467-9280.2006.01693.x",
  },
  spacing: {
    label: "Cepeda et al., 2006",
    href: "https://doi.org/10.1037/0033-2909.132.3.354",
  },
  fsrs: {
    label: "FSRS",
    href: "https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS",
  },
  benchmark: {
    label: "порівняння алгоритмів",
    href: "https://github.com/open-spaced-repetition/srs-benchmark",
  },
};

function Source({ source }: { source: { label: string; href: string } }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-xs text-faint underline decoration-line-strong underline-offset-4 transition hover:text-accent"
      href={source.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {source.label}
      <ExternalLink aria-hidden="true" className="size-3" />
      <span className="sr-only">(відкриється в новій вкладці)</span>
    </a>
  );
}

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight md:text-4xl">{title}</h2>
      {lead ? <p className="mt-3 text-[15px] leading-7 text-muted md:text-base">{lead}</p> : null}
    </div>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <a aria-label="Memora — на початок" className="rounded-lg" href="#top">
          <Wordmark markClassName="size-7" />
        </a>
        <nav aria-label="Розділи сторінки" className="hidden items-center gap-1 text-sm text-muted lg:flex">
          {[
            ["#how", "Як це працює"],
            ["#exercises", "Вправи"],
            ["#words", "Звідки слова"],
            ["#faq", "Питання"],
          ].map(([href, label]) => (
            <a key={href} className="rounded-lg px-3 py-2 transition hover:bg-surface-3 hover:text-text" href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <AuthButton hideWhenSignedIn mode="sign-in" size="sm" variant="ghost">
            Увійти
          </AuthButton>
          <AuthButton mode="sign-up" size="sm">
            Хочу доступ
          </AuthButton>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(62,224,191,0.13),transparent_70%),radial-gradient(40%_50%_at_15%_10%,rgba(155,140,255,0.10),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2/80 px-3 py-1 text-xs text-text-2">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            Закрита бета · тренажер англійських слів
          </p>
          <h1 className="mt-4 text-balance text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">
            Англійські слова, які ти <span className="text-accent-strong">згадаєш</span>, а не лише впізнаєш
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-text-2 md:text-lg md:leading-8">
            Для тих, хто читає англійською, але в розмові потрібне слово не спадає на думку. Memora спершу просить
            згадати — відповідь з’являється тільки після спроби. А повертає слово саме тоді, коли воно починає
            забуватися.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <AuthButton className="px-6" mode="sign-up">
              Хочу доступ
              <ArrowRight className="size-4" />
            </AuthButton>
            <AuthButton hideWhenSignedIn mode="sign-in" variant="secondary">
              У мене є запрошення
            </AuthButton>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {["10–15 хвилин на день", "6 типів вправ", "телефон і комп’ютер"].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-4 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md">
          <DemoCard />
          <p className="mt-3 text-center text-xs leading-5 text-faint">
            Справжня перевірка з Memora. Спробуй з опискою або іншою формою слова.
          </p>
        </div>
      </div>
    </section>
  );
}

const principles = [
  {
    icon: PenLine,
    title: "Спершу згадай",
    text: "Відповідь не видно, доки ти не спробуєш. Саме зусилля пригадати закріплює слово — перечитування дає лише відчуття, що знаєш.",
    source: sources.testing,
  },
  {
    icon: Sparkles,
    title: "Повтор — коли починаєш забувати",
    text: "Алгоритм FSRS рахує для кожного слова, коли ти його от-от забудеш, і ставить повтор саме туди. Легкі слова приходять рідко, важкі — частіше.",
    source: sources.spacing,
  },
  {
    icon: Mic,
    title: "Від впізнавання до мовлення",
    text: "Слово проходить шлях від «впізнати» до «скажи вголос». Наступна вправа відкривається, коли попередня вже тримається.",
    source: null,
  },
];

function Principles() {
  return (
    <section aria-labelledby="principles-title" className="border-y border-line/70 bg-surface-1/60">
      <h2 className="sr-only" id="principles-title">
        Чим Memora відрізняється
      </h2>
      <div className="mx-auto grid max-w-6xl gap-px overflow-hidden px-4 py-2 md:grid-cols-3 md:px-6">
        {principles.map(({ icon: Icon, title, text, source }) => (
          <div key={title} className="flex gap-3 py-5 md:flex-col md:gap-3 md:px-5 md:py-8 md:first:pl-0 md:last:pr-0">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
              {source ? (
                <p className="mt-2">
                  <Source source={source} />
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const gaps = reviewGaps(4).map((days) => formatInterval(new Date(0), new Date(days * 86_400_000)));
  const steps = [
    {
      title: "Згадай",
      text: "Напиши відповідь або згадай подумки. Підказок до спроби немає.",
    },
    {
      title: "Memora оцінює сама",
      text: "Точно, з опискою, інша форма чи синонім — і як швидко. Натискати «знав / не знав» не треба, але оцінку можна змінити.",
    },
    {
      title: "Наступний повтор",
      text: `Згадав впевнено — пауза росте: ${gaps.join(" → ")}. Помилився — слово повернеться скоро.`,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl scroll-mt-14 px-4 py-14 md:px-6 md:py-20" id="how">
      <SectionHead
        eyebrow="Як це працює"
        lead="Мета — тримати шанс згадати слово вище 90 % і не витрачати час на те, що ти й так пам’ятаєш."
        title="Повтор саме тоді, коли слово починає вилітати з голови"
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <div className="rounded-3xl border border-line bg-surface-2 p-4 md:p-6">
          <RetentionChart />
          <p className="mt-3 text-xs leading-5 text-faint">
            Розраховано тим самим алгоритмом, що й у практиці (FSRS-6), для слова, яке ти щоразу згадуєш правильно.
            Для кожного слова й кожної відповіді інтервали свої.{" "}
            <Source source={sources.fsrs} /> · <Source source={sources.benchmark} />
          </p>
        </div>
        <ol className="grid content-start gap-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 rounded-2xl border border-line bg-surface-1 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-4 font-mono text-sm text-accent-strong">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{step.text}</p>
              </div>
            </li>
          ))}
          <li className="rounded-2xl border border-dashed border-line-strong p-4 text-sm leading-6 text-muted">
            <span className="font-semibold text-text-2">Одне слово — одна картка на день.</span> Якщо ти щойно
            перекладав слово, речення з ним сьогодні не з’явиться: інакше одна вправа підказувала б іншу.
          </li>
        </ol>
      </div>
    </section>
  );
}

function ExerciseCard({
  icon: Icon,
  title,
  tag,
  paid = false,
  children,
}: {
  icon: typeof Eye;
  title: string;
  tag: string;
  paid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className={`size-4 ${paid ? "text-violet" : "text-accent"}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-medium ${paid ? "bg-violet-soft text-violet" : "bg-surface-4 text-muted"}`}>
          {tag}
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center rounded-xl bg-surface-1 p-3">{children}</div>
    </li>
  );
}

function Exercises() {
  return (
    <section className="border-t border-line/70 bg-surface-1/40">
      <div className="mx-auto max-w-6xl scroll-mt-14 px-4 py-14 md:px-6 md:py-20" id="exercises">
        <SectionHead
          eyebrow="Шість вправ"
          lead="Ось як одна фраза, figure out — «розібратися», проходить усі шість. Вправи відкриваються по черзі: «своє речення» — коли слово тримається від тижня, «вголос» — після нього."
          title="Від «впізнаю» до «кажу сам»"
        />
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ExerciseCard icon={Eye} tag="англ → укр" title="1. Впізнати">
            <p className="text-lg font-semibold" lang="en">
              figure out
            </p>
            <p className="mt-1 text-sm text-muted">→ розібратися, зрозуміти</p>
          </ExerciseCard>
          <ExerciseCard icon={PenLine} tag="укр → англ" title="2. Згадати">
            <p className="text-sm text-muted">розібратися, зрозуміти →</p>
            <p className="mt-1 rounded-lg border border-accent/50 bg-surface-2 px-3 py-1.5 font-semibold" lang="en">
              figure out<span aria-hidden="true" className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-accent" />
            </p>
          </ExerciseCard>
          <ExerciseCard icon={TextCursorInput} tag="контекст" title="3. Речення з пропуском">
            <p className="text-[15px] font-semibold" lang="en">
              I can’t _____ _____ what she wants.
            </p>
            <p className="mt-1 text-sm text-muted">Не можу зрозуміти, чого вона хоче.</p>
          </ExerciseCard>
          <ExerciseCard icon={Headphones} tag="на слух" title="4. На слух">
            <div className="flex items-center gap-3">
              <PlayClip large label="Прослухати фразу" src="/landing/figure-out.mp3" />
              <div className="min-w-0">
                <p className="text-sm text-text-2">Впиши, що почув</p>
                <p className="text-xs text-faint">Натисни — це голос, яким говорить Memora</p>
              </div>
            </div>
          </ExerciseCard>
          <ExerciseCard icon={MessageSquareText} paid tag="AI-відгук" title="5. Своє речення">
            <p className="text-sm italic text-text-2" lang="en">
              “I can’t figure out what does she want.”
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              <span className="font-medium text-accent">Слово вжито правильно.</span> У непрямому питанні порядок
              прямий: <span className="text-text-2" lang="en">what she wants</span>.
            </p>
          </ExerciseCard>
          <ExerciseCard icon={Mic} paid tag="AI-відгук" title="6. Скажи вголос">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-danger-soft text-danger">
                <Mic aria-hidden="true" className="size-4" />
              </span>
              <span className="font-mono text-xs text-faint">0:04</span>
              <span className="ml-auto rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                Слово розпізнано
              </span>
            </div>
            <p className="mt-2 text-sm italic text-text-2" lang="en">
              “I finally figured out the new schedule.”
            </p>
          </ExerciseCard>
        </ol>
        <p className="mt-4 text-sm leading-6 text-muted">
          Перші чотири — без обмежень. Для письма й говоріння є денна квота, яка залежить від твого часу на практику;
          аудіо не зберігається, говоріння можна вимкнути.
        </p>
      </div>
    </section>
  );
}

function WordSources() {
  return (
    <section className="mx-auto max-w-6xl scroll-mt-14 px-4 py-14 md:px-6 md:py-20" id="words">
      <SectionHead
        eyebrow="Звідки слова"
        lead="Не треба самому складати списки: програма підбирає слова під твій рівень і цілі, а свої можна додати за секунди."
        title="Почни з тесту — далі слова приходять самі"
      />
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface-2 p-4 md:p-5">
          <h3 className="font-semibold tracking-tight">Тест словникового запасу</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            5–7 хвилин: «знаєш це слово?» і перевірка значень. Серед слів є неіснуючі — так тест помічає вгадування.
            Слова, які ти вже знаєш, одразу йдуть у складніші вправи.
          </p>
          <div className="mt-4 rounded-xl bg-surface-1 p-4 text-center">
            <p className="text-xs text-faint">Знаєш це слово?</p>
            <p className="mt-1 text-2xl font-semibold" lang="en">
              reliable
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
              <span className="rounded-xl border border-line-strong py-2 text-text-2">Не знаю</span>
              <span className="rounded-xl bg-accent py-2 text-accent-ink">Знаю</span>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-surface-2 p-4 md:p-5">
          <h3 className="font-semibold tracking-tight">Щоденна програма за цілями</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Найуживаніші слова англійської (частотні списки NGSL) і тематичні добірки. Скільки нових слів на день —
            Memora рахує з твоїх хвилин і того, скільки вже на повторенні.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 rounded-xl bg-surface-1 p-4 text-sm">
            {[
              ["Робота й IT", true],
              ["Подорожі", false],
              ["Розмовна", true],
              ["Загальна", false],
            ].map(([label, active]) => (
              <span
                key={String(label)}
                className={`rounded-full border px-3 py-1.5 ${active ? "border-accent/60 bg-accent-soft text-accent" : "border-line-strong text-muted"}`}
              >
                {label}
              </span>
            ))}
            <span className="basis-full pt-1 text-xs text-faint">Наприклад, 15 хв на день — близько 6 нових слів на старті</span>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-surface-2 p-4 md:p-5">
          <h3 className="font-semibold tracking-tight">Своє слово — картка за секунду</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Впиши слово чи фразу, натисни «Заповнити з AI» — переклад, приклади й форми з’являться самі. Перевір і
            збережи.
          </p>
          <div className="mt-4 grid gap-2 rounded-xl bg-surface-1 p-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 font-semibold" lang="en">
                get used to
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-3 py-2 text-xs font-semibold text-accent">
                <Sparkles aria-hidden="true" className="size-3.5" />
                AI
              </span>
            </div>
            <p className="text-text-2">звикнути до</p>
            <p className="italic text-muted" lang="en">
              You’ll get used to it after a week or two.
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-surface-2 p-4 md:p-5">
          <h3 className="font-semibold tracking-tight">З тексту</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Встав абзац зі статті чи листа і тапни незнайомі слова. Сусідні тапи стають фразою. До 20 слів за раз.
          </p>
          <p className="mt-4 rounded-xl bg-surface-1 p-4 text-[15px] leading-8 text-text-2" lang="en">
            We need a quick{" "}
            <mark className="rounded-md bg-accent-soft px-1 py-0.5 text-accent">workaround</mark> before the release,
            or we’ll{" "}
            <mark className="rounded-md bg-accent-soft px-1 py-0.5 text-accent">fall behind</mark> again.
          </p>
        </article>
      </div>
    </section>
  );
}

function Habit() {
  const week = [
    ["Пн", "done"],
    ["Вт", "done"],
    ["Ср", "freeze"],
    ["Чт", "done"],
    ["Пт", "done"],
    ["Сб", "done"],
    ["Нд", "today"],
  ] as const;

  return (
    <section className="border-t border-line/70 bg-surface-1/40">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
        <SectionHead
          eyebrow="Щодня потроху"
          lead="Пам’ять тримають регулярні короткі заняття, а не марафони у вихідні. Memora допомагає не випадати з ритму."
          title="10–15 хвилин на день — і звичка тримається"
        />
        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-line bg-surface-2 p-4 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Flame aria-hidden="true" className="size-4 text-amber" />
              <h3 className="text-sm font-semibold">Денна ціль і серія</h3>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">
              Ціль виконано, коли набрав свої хвилини або повторив усе на сьогодні. Один пропущений день на тиждень
              серію не скидає — спрацьовує заморозка.
            </p>
            <div className="mt-4 rounded-xl bg-surface-1 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-2">Ціль дня: 8 з 15 хв</span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber">
                  <Flame aria-hidden="true" className="size-3.5" />6 днів
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface-4">
                <div className="h-full w-[53%] rounded-full bg-accent" />
              </div>
              <ul aria-label="Приклад тижня" className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[11px] text-faint">
                {week.map(([day, state]) => (
                  <li key={day}>
                    <span
                      className={`mx-auto grid size-7 place-items-center rounded-lg ${
                        state === "done"
                          ? "bg-accent-soft text-accent"
                          : state === "freeze"
                            ? "bg-violet-soft text-violet"
                            : "border border-dashed border-line-strong"
                      }`}
                    >
                      {state === "done" ? (
                        <Check aria-label="ціль виконано" className="size-3.5" />
                      ) : state === "freeze" ? (
                        <Snowflake aria-label="заморозка" className="size-3.5" />
                      ) : (
                        <span className="sr-only">сьогодні</span>
                      )}
                    </span>
                    <span className="mt-1 block">{day}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-2">
              <Bell aria-hidden="true" className="size-4 text-accent" />
              <h3 className="text-sm font-semibold">Нагадування</h3>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">
              Одне на день, у вибраний час — і лише якщо ціль ще не виконана.
            </p>
            <div className="mt-4 flex gap-2.5 rounded-xl bg-surface-4/70 p-3 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.8)]">
              <LogoMark className="size-8" />
              <div className="min-w-0 text-xs leading-5">
                <p className="font-semibold text-text">Memora</p>
                <p className="text-text-2">Сьогодні чекає 12 слів. Кілька хвилин — і ціль дня виконано.</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-2">
              <Smartphone aria-hidden="true" className="size-4 text-accent" />
              <h3 className="text-sm font-semibold">Як застосунок на Android</h3>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">
              Встановлюється на головний екран. Побачив слово в іншій програмі — «Поділитися → Memora»: слово відкриє
              нову картку, абзац — «З тексту».
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-1 p-3 text-xs text-text-2">
              <Share2 aria-hidden="true" className="size-4 text-muted" />
              Поділитися
              <ArrowRight aria-hidden="true" className="size-3.5 text-faint" />
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-2 py-1 font-semibold text-text">
                <LogoMark className="size-4" />
                Memora
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

const faq = [
  {
    q: "Як отримати доступ?",
    a: "Зараз Memora — закрита бета. Створи акаунт: щойно тебе додадуть, увійдеш із тим самим email і паролем. Якщо тебе вже запросили — просто увійди.",
  },
  {
    q: "Для якого рівня?",
    a: "Для тих, хто вже трохи читає англійською. Тест на початку покаже, з яких слів почати, щоб не витрачати час на знайоме.",
  },
  {
    q: "А на iPhone працює?",
    a: "У браузері — так, на будь-якому телефоні чи комп’ютері. Встановлення на екран, «Поділитися» й нагадування ми перевіряли на Android (Chrome).",
  },
  {
    q: "Можна без інтернету?",
    a: "Поки ні: картки й прогрес зберігаються на сервері, офлайн-режиму ще немає.",
  },
  {
    q: "Хто бачить мої слова?",
    a: "Лише ти. Свої картки можна будь-коли вивантажити у файл.",
  },
];

function Faq() {
  return (
    <section className="mx-auto max-w-3xl scroll-mt-14 px-4 py-14 md:px-6 md:py-20" id="faq">
      <SectionHead eyebrow="Питання" title="Коротко про головне" />
      <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface-1">
        {faq.map((item) => (
          <details key={item.q} className="group px-4 md:px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <Plus aria-hidden="true" className="size-4 shrink-0 text-muted transition group-open:rotate-45" />
            </summary>
            <p className="pb-4 text-sm leading-6 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-14 md:px-6 md:pb-20">
      <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-surface-2 px-5 py-10 text-center md:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(62,224,191,0.14),transparent_70%)]"
        />
        <h2 className="relative mx-auto max-w-2xl text-balance text-2xl font-semibold tracking-tight md:text-4xl">
          Перший крок — тест на 5–7 хвилин
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-[15px] leading-7 text-muted">
          Після входу Memora визначить твій словниковий запас, і перші слова з’являться в той самий день.
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          <AuthButton className="px-6" mode="sign-up">
            Хочу доступ
            <ArrowRight className="size-4" />
          </AuthButton>
          <AuthButton hideWhenSignedIn mode="sign-in" variant="secondary">
            Увійти
          </AuthButton>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs leading-5 text-faint md:flex-row md:items-center md:justify-between md:px-6">
        <Wordmark markClassName="size-6" />
        <p className="inline-flex items-center gap-1.5">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Твої слова бачиш лише ти
        </p>
        <p>
          Частотні списки:{" "}
          <a className="underline underline-offset-4 hover:text-accent" href="https://www.newgeneralservicelist.com/" rel="noopener noreferrer" target="_blank">
            NGSL, NGSL-Spoken, BSL
          </a>{" "}
          (Browne, Culligan, Phillips), CC BY-SA 4.0
        </p>
      </div>
    </footer>
  );
}
