"use client";

import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ChevronDown,
  Gauge,
  Keyboard,
  Smartphone,
  Target,
  UserCircle,
} from "lucide-react";
import type * as React from "react";
import type { IconType } from "./types";
import { PageHeader } from "./shared-ui";

type HelpSection = {
  id: string;
  icon: IconType;
  title: string;
  summary: string;
  body: React.ReactNode;
};

const ratingRows = [
  {
    label: "Не згадав",
    tone: "text-danger",
    text: "Не зміг відповісти або помилився по суті. Картка повернеться за кілька хвилин.",
  },
  {
    label: "Важко",
    tone: "text-amber",
    text: "Згадав, але довго або з підказкою. Інтервал зросте трохи. (Режим 4 кнопок.)",
  },
  {
    label: "Згадав",
    tone: "text-accent",
    text: "Нормально згадав. Основна кнопка — тисни її в більшості випадків.",
  },
  {
    label: "Легко",
    tone: "text-violet",
    text: "Відповідь миттєва. Картка надовго відкладеться. (Режим 4 кнопок.)",
  },
];

const shortcuts = [
  ["Enter", "показати / перевірити відповідь"],
  ["Shift + Enter", "новий рядок у відповіді"],
  ["1 – 4", "оцінити (у режимі 2 кнопок: 1 і 2)"],
  ["Пробіл", "запропонована оцінка після перевірки"],
  ["Z", "скасувати останню оцінку"],
];

const sections: HelpSection[] = [
  {
    id: "help-core",
    icon: BrainCircuit,
    title: "Як це працює",
    summary: "Згадування замість перечитування + розумний розклад.",
    body: (
      <>
        <p>
          Memora побудована на двох перевірених принципах.{" "}
          <b>Активне пригадування</b>: ти спершу згадуєш відповідь сам, і саме це
          зусилля зміцнює пам’ять. <b>Інтервальні повторення</b>: картка
          повертається тоді, коли ти от-от її забудеш.
        </p>
        <p>
          Розклад рахує алгоритм FSRS. Після кожної оцінки він оновлює
          «стабільність» картки й вирішує, коли показати її знову: легкі —
          через тижні й місяці, складні — вже сьогодні або завтра.
        </p>
      </>
    ),
  },
  {
    id: "help-practice",
    icon: Target,
    title: "Практика",
    summary: "Щоденна черга: спочатку повторення, потім нові картки.",
    body: (
      <>
        <p>
          На головному екрані — тільки те, що варто пройти зараз. Режими{" "}
          <b>Усе / Англійська / QA</b> фільтрують чергу; число поруч показує,
          скільки карток чекає.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Прочитай питання й спробуй відповісти — письмово або подумки.</li>
          <li>
            Натисни «Перевірити». Якщо писав, Memora порівняє відповідь: пробачить
            регістр, артиклі й дрібні описки.
          </li>
          <li>Оціни себе чесно — наступна картка з’явиться миттєво.</li>
        </ol>
        <p>
          Помилився кнопкою? Тисни ↶ над карткою або клавішу Z. Картку, яка
          заважає, можна поставити на паузу (⏸) — вона зникне з черги, поки ти
          не повернеш її в розділі матеріалів.
        </p>
        <p>
          Нових карток на день не більше, ніж задано в профілі. Хочеш ще — після
          сесії натисни «Ще 5 нових».
        </p>
      </>
    ),
  },
  {
    id: "help-ratings",
    icon: Gauge,
    title: "Як оцінювати",
    summary: "Чесна оцінка = точний розклад.",
    body: (
      <>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {ratingRows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
              <span className={`w-24 shrink-0 font-semibold ${row.tone}`}>{row.label}</span>
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
        <p>
          Під кожною кнопкою видно, коли картка повернеться. Якщо Memora
          перевірила твою відповідь, рекомендована кнопка підсвічена.
        </p>
      </>
    ),
  },
  {
    id: "help-keys",
    icon: Keyboard,
    title: "Гарячі клавіші",
    summary: "Проходь картки, не відриваючи рук від клавіатури.",
    body: (
      <ul className="grid gap-2 sm:grid-cols-2">
        {shortcuts.map(([key, text]) => (
          <li key={key} className="flex items-center gap-3">
            <kbd className="min-w-16 rounded-lg border border-line-strong bg-surface-1 px-2 py-1 text-center font-mono text-xs text-text">
              {key}
            </kbd>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "help-materials",
    icon: BookOpenCheck,
    title: "Слова й терміни",
    summary: "Додавай вручну або списком із таблиці.",
    body: (
      <>
        <p>
          Кожне слово стає двома картками: «як сказати англійською» і «що
          означає». Кожен QA-термін — «поясни термін» і «згадай термін за
          поясненням». Кілька варіантів перекладу пиши через кому — зараховано
          буде будь-який.
        </p>
        <p>
          <b>Імпорт CSV</b>: завантаж шаблон, заповни в Google Таблицях чи Excel
          і перетягни файл у вікно імпорту. Перед додаванням побачиш, які рядки
          готові, які схожі на наявні, а де помилка.
        </p>
        <p>
          Відкрий матеріал, щоб виправити текст (прогрес повторень збережеться),
          поставити на паузу або видалити. Фільтр «Складні» покаже те, на чому
          ти часто помиляєшся — зазвичай допомагає кращий приклад.
        </p>
      </>
    ),
  },
  {
    id: "help-progress",
    icon: BarChart3,
    title: "Прогрес",
    summary: "Серія, активність, прогноз і слабкі місця.",
    body: (
      <>
        <p>
          <b>Серія</b> — скільки днів поспіль ти практикуєшся. <b>Активність</b>{" "}
          — календар повторень за останні місяці. <b>Прогноз</b> — скільки карток
          повернеться найближчого тижня.
        </p>
        <p>
          <b>Стадії</b> показують шлях картки: нова → вчиться → молода →
          закріплена (інтервал від 3 тижнів). Мета — щоб закріплених ставало
          більше.
        </p>
      </>
    ),
  },
  {
    id: "help-profile",
    icon: UserCircle,
    title: "Профіль і дані",
    summary: "Ліміт нових карток, кнопки, пароль, резервна копія.",
    body: (
      <>
        <p>
          Для старту вистачить 5–10 нових карток на день. Режим 2 кнопок
          простіший; 4 кнопки дають точніший розклад.
        </p>
        <p>
          Регулярно завантажуй <b>повну копію</b> (JSON) — з неї можна відновити
          все: матеріали, картки й історію. CSV зручні, щоб відкрити список у
          таблиці.
        </p>
      </>
    ),
  },
  {
    id: "help-mobile",
    icon: Smartphone,
    title: "На телефоні",
    summary: "Додай Memora на головний екран.",
    body: (
      <p>
        iPhone: Safari → «Поділитися» → «На екран “Додому”». Android: Chrome → меню
        ⋮ → «Додати на головний екран». Memora відкриватиметься як окремий
        застосунок, без адресного рядка.
      </p>
    ),
  },
];

export function HelpWorkspace() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Довідка"
        description="Коротко про те, як отримати максимум від Memora."
      />

      <div className="space-y-3">
        {sections.map((section, index) => (
          <details
            key={section.id}
            className="group rounded-2xl border border-line bg-surface-2/60 transition open:border-line-strong open:bg-surface-2"
            id={section.id}
            open={index < 2}
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <section.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold tracking-tight">{section.title}</span>
                <span className="block text-sm text-muted">{section.summary}</span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-faint transition group-open:rotate-180" />
            </summary>
            <div className="space-y-3 px-5 pb-5 text-[15px] leading-7 text-text-2 md:pl-[76px] [&_b]:font-semibold [&_b]:text-text">
              {section.body}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
