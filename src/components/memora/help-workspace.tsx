"use client";

import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpenCheck,
  Brain,
  Check,
  Clock3,
  Code2,
  Download,
  FileText,
  Flame,
  Gauge,
  KeyRound,
  Languages,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserCircle,
} from "lucide-react";
import type { IconType } from "./types";
import { MiniStat, ShellPanel } from "./shared-ui";

export function HelpWorkspace() {
  type HelpInfoItem = {
    icon: IconType;
    title: string;
    text: string;
  };
  type HelpTextItem = {
    title: string;
    text: string;
  };
  type HelpTocItem = HelpInfoItem & {
    href: string;
  };

  const tocItems: HelpTocItem[] = [
    {
      href: "#help-core",
      icon: Brain,
      title: "Суть",
      text: "для чого Memora і чому вона працює",
    },
    {
      href: "#help-practice",
      icon: Target,
      title: "Практика",
      text: "черга, режими і щоденний сценарій",
    },
    {
      href: "#help-materials",
      icon: BookOpenCheck,
      title: "Матеріали",
      text: "слова, QA, картки, пауза, CSV",
    },
    {
      href: "#help-ratings",
      icon: Gauge,
      title: "Оцінювання",
      text: "як вибирати кнопки після відповіді",
    },
    {
      href: "#help-progress",
      icon: BarChart3,
      title: "Прогрес",
      text: "динаміка, історія, слабкі картки",
    },
    {
      href: "#help-profile",
      icon: UserCircle,
      title: "Профіль",
      text: "налаштування, пароль, доступ",
    },
    {
      href: "#help-map",
      icon: FileText,
      title: "Карта",
      text: "що є в кожному розділі сервісу",
    },
  ];

  const corePrinciples: HelpInfoItem[] = [
    {
      icon: Brain,
      title: "Активне пригадування",
      text: "Ти спочатку пишеш відповідь з пам'яті, а вже потім відкриваєш правильний варіант. Це тренує саме згадування, а не пасивне перечитування.",
    },
    {
      icon: Clock3,
      title: "Інтервали повторення",
      text: "Картка повертається тоді, коли її вже корисно повторити. Легкі картки відкладаються далі, складні повертаються швидше.",
    },
    {
      icon: Gauge,
      title: "FSRS-розклад",
      text: "Memora використовує FSRS: після кожної оцінки перераховується наступна дата повторення, складність і стабільність картки.",
    },
    {
      icon: Languages,
      title: "Пояснення українською",
      text: "Англійські слова й QA-терміни можуть лишатися англійською, але сенс пояснюється українською. Так простіше вчити зміст, а не набір символів.",
    },
  ];

  const practiceSteps: HelpTextItem[] = [
    {
      title: "Відкрий практику",
      text: "Це головний робочий екран. Тут зібрані картки, які потрібно пройти зараз.",
    },
    {
      title: "Напиши відповідь",
      text: "Не підглядай одразу. Навіть неповна відповідь корисніша, ніж просто прочитати правильний варіант.",
    },
    {
      title: "Перевір себе",
      text: "Натисни «Перевірити відповідь», порівняй зі своєю відповіддю і подивись пояснення.",
    },
    {
      title: "Оціни чесно",
      text: "Оцінка має показувати, як легко ти згадав зараз. Не оцінюй за бажанням «хочу знати це краще».",
    },
    {
      title: "Додавай тільки потрібне",
      text: "Якщо зустрів слово або QA-термін, додай його вручну або через CSV. Не перетворюй Memora на склад «колись вивчу».",
    },
  ];
  const practiceStepIcons = [Target, Brain, BookOpenCheck, Gauge, Plus];

  const practiceMetrics: HelpInfoItem[] = [
    {
      icon: ListChecks,
      title: "Повторити",
      text: "Картки, які вже вивчались і сьогодні знову мають бути згадані.",
    },
    {
      icon: Plus,
      title: "Нові",
      text: "Картки, які можна взяти сьогодні без перевантаження денного ліміту.",
    },
    {
      icon: Clock3,
      title: "Час",
      text: "Орієнтовна тривалість поточної черги. Це не таймер, а швидка оцінка навантаження.",
    },
    {
      icon: Gauge,
      title: "Якість",
      text: "Частка успішних повторень. Якщо значення падає, краще не додавати багато нового.",
    },
    {
      icon: Flame,
      title: "Закріплені",
      text: "Картки, які вже добре тримаються в пам'яті й мають довші інтервали повторення.",
    },
  ];

  const modeItems: HelpTextItem[] = [
    {
      title: "Усе",
      text: "Змішана черга: англійська і QA разом. Добре підходить для звичайної щоденної практики.",
    },
    {
      title: "Англійська",
      text: "Фокус тільки на словах і фразах. Зручно, коли хочеш потренувати активний словник.",
    },
    {
      title: "QA",
      text: "Фокус на термінах і поясненнях з тестування. Корисно перед співбесідою або робочою підготовкою.",
    },
  ];

  const sectionItems: HelpInfoItem[] = [
    {
      icon: Target,
      title: "Практика",
      text: "Головне місце для навчання. Тут проходиш чергу, пишеш відповідь, перевіряєш себе і ставиш оцінку.",
    },
    {
      icon: Languages,
      title: "Англійські слова",
      text: "База англійських слів і фраз. Тут можна шукати, редагувати, ставити матеріали на паузу, видаляти й імпортувати CSV.",
    },
    {
      icon: Code2,
      title: "QA та тестування",
      text: "База QA-термінів. Основний принцип той самий, але пояснення краще писати українською, щоб точно розуміти сенс терміна.",
    },
    {
      icon: BarChart3,
      title: "Прогрес",
      text: "Огляд повторень, слабких місць і стану матеріалів. Сюди варто заходити періодично, а не після кожної картки.",
    },
    {
      icon: UserCircle,
      title: "Профіль",
      text: "Рівень англійської, навчальна ціль, ліміт нових карток, режим оцінювання, пароль і резервні копії.",
    },
    {
      icon: FileText,
      title: "Як користуватись",
      text: "Ця довідка. Тут зібрана логіка сервісу, пояснення розділів, налаштувань і правил роботи з даними.",
    },
  ];

  const materialItems: HelpInfoItem[] = [
    {
      icon: Languages,
      title: "Англійський матеріал",
      text: "Заповнюєш слово або фразу, українське значення і приклад. Memora створює картку на активний переклад та картку на розуміння значення.",
    },
    {
      icon: Code2,
      title: "QA-матеріал",
      text: "Заповнюєш термін, коротке пояснення і приклад. Memora створює картку на пояснення терміна та картку на пригадування терміна за описом.",
    },
    {
      icon: Sparkles,
      title: "Попередній перегляд карток",
      text: "Під час додавання видно, які картки будуть створені. Якщо формулювання виглядає нечітко, краще виправити матеріал одразу.",
    },
    {
      icon: Search,
      title: "Пошук і редагування",
      text: "У розділах матеріалів можна знайти запис, змінити його зміст і подивитися пов'язані картки.",
    },
  ];

  const statusItems: HelpTextItem[] = [
    {
      title: "В навчанні",
      text: "Матеріал або картка активні й можуть потрапляти в чергу практики.",
    },
    {
      title: "На паузі",
      text: "Тимчасово прибрано з черги. Корисно для нечітких або зайвих карток, які ще не хочеш видаляти.",
    },
    {
      title: "Видалити",
      text: "Повністю прибирає матеріал разом з його картками та історією повторень. Перед видаленням Memora попросить підтвердження.",
    },
  ];

  const ratingItems = [
    {
      label: "Знову",
      tone: "border-[#6f2b2b] bg-[#2a1215] text-[#ffb4aa]",
      text: "Не згадав або згадав неправильно. Картка повернеться швидко.",
    },
    {
      label: "Важко",
      tone: "border-[#76551f] bg-[#2d2110] text-[#ffd38a]",
      text: "Згадав із великою напругою. Є тільки в розширених кнопках.",
    },
    {
      label: "Добре",
      tone: "border-[#256b60] bg-[#102b27] text-[#8df3dd]",
      text: "Згадав достатньо впевнено. Це основна нормальна оцінка.",
    },
    {
      label: "Легко",
      tone: "border-[#48408c] bg-[#211f44] text-[#b8b0ff]",
      text: "Відповідь прийшла майже миттєво. Є тільки в розширених кнопках.",
    },
  ];

  const progressItems: HelpInfoItem[] = [
    {
      icon: Activity,
      title: "Останні повторення",
      text: "Список останніх оцінених карток. Він прокручується всередині блоку, тому не розтягує сторінку.",
    },
    {
      icon: AlertCircle,
      title: "Слабкі картки",
      text: "Картки, які часто повертаються після помилок. Якщо вони повторюються, краще відредагувати формулювання.",
    },
    {
      icon: BookOpenCheck,
      title: "Матеріали",
      text: "Показує кількість матеріалів і карток у навчанні, на паузі та за джерелом додавання.",
    },
    {
      icon: Gauge,
      title: "Якість",
      text: "Орієнтир за останніми повтореннями. Якщо якість падає, не поспішай додавати багато нових карток.",
    },
  ];

  const profileSettings: HelpInfoItem[] = [
    {
      icon: Gauge,
      title: "Рівень англійської",
      text: "Особистий орієнтир для тебе. Він не змінює алгоритм повторень, але допомагає тримати контекст навчання в профілі.",
    },
    {
      icon: Target,
      title: "Основна ціль",
      text: "Коротко фіксує, навіщо ти зараз вчиш матеріал: співбесіди, робота, словник для конкретної теми або інша задача.",
    },
    {
      icon: Plus,
      title: "Нових на день",
      text: "Обмежує кількість нових карток на день. Повторення мають пріоритет, а ліміт можна підняти до 50.",
    },
    {
      icon: ListChecks,
      title: "Оцінювання",
      text: "Перемикає просту схему з двома кнопками або розширену з чотирма оцінками для точнішого розкладу.",
    },
    {
      icon: Download,
      title: "Дані",
      text: "Повна JSON-копія, CSV-експорт і відновлення з preview. Це захист твоєї особистої бази знань.",
    },
    {
      icon: Trash2,
      title: "Очищення даних",
      text: "Окремі кнопки видаляють усі матеріали або обнуляють статистику. Це незворотні дії, тому вони винесені окремо й потребують підтвердження.",
    },
    {
      icon: KeyRound,
      title: "Пароль і відновлення",
      text: "У профілі можна змінити пароль або надіслати лист для відновлення доступу на email акаунта.",
    },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <ShellPanel className="p-4 md:p-5">
          <div className="max-w-4xl">
            <p className="text-sm font-medium text-[#52e0c4]">Довідка</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight md:text-3xl">
              Як Memora працює і як нею користуватись.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#9aa8ba]">
              Memora перетворює англійські слова й QA-терміни на картки для
              активного пригадування. Ти спочатку відповідаєш з пам&apos;яті,
              потім перевіряєш себе, ставиш чесну оцінку, а сервіс планує
              наступне повторення.
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Головна дія" value="згадати" />
            <MiniStat label="Розклад" value="FSRS" />
            <MiniStat label="Пояснення" value="укр." />
          </div>
        </ShellPanel>

        <HelpSection
          id="help-core"
          icon={Brain}
          kicker="Суть і алгоритм"
          title="Чому це ефективніше за перечитування."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {corePrinciples.map((item) => (
              <HelpCard key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </HelpCard>
            ))}
          </div>
          <div className="mt-4">
            <h3 className="font-semibold">Цикл однієї картки</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {practiceSteps.map((step, index) => (
                <HelpStep
                  key={step.title}
                  index={index + 1}
                  title={step.title}
                  text={step.text}
                />
              ))}
            </div>
          </div>
        </HelpSection>

        <HelpSection
          id="help-practice"
          icon={Target}
          kicker="Практика"
          title="Головний екран потрібен тільки для навчання тут і зараз."
        >
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <HelpSubsection title="Режими черги">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {modeItems.map((item) => (
                  <HelpMiniBlock key={item.title} title={item.title} text={item.text} />
                ))}
              </div>
            </HelpSubsection>
            <HelpSubsection title="Щоденний порядок">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {practiceSteps.map((step, index) => (
                  <HelpLine
                    key={step.title}
                    icon={practiceStepIcons[index] ?? Target}
                    title={step.title}
                    text={step.text}
                  />
                ))}
              </div>
            </HelpSubsection>
          </div>
          <HelpSubsection className="mt-4" title="Метрики зверху">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {practiceMetrics.map((item) => (
                <HelpCard key={item.title} icon={item.icon} title={item.title}>
                  {item.text}
                </HelpCard>
              ))}
            </div>
          </HelpSubsection>
        </HelpSection>

        <HelpSection
          id="help-materials"
          icon={BookOpenCheck}
          kicker="Матеріали і картки"
          title="Матеріал це запис, а картки це вправи, які Memora з нього створює."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {materialItems.map((item) => (
              <HelpCard key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </HelpCard>
            ))}
          </div>
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
            <HelpSubsection title="Статуси">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {statusItems.map((item) => (
                  <HelpMiniBlock key={item.title} title={item.title} text={item.text} />
                ))}
              </div>
            </HelpSubsection>
            <HelpSubsection title="CSV-імпорт">
              <div className="space-y-3">
                <HelpLine
                  icon={Download}
                  title="Шаблон"
                  text="Скачай шаблон CSV у потрібному розділі, щоб колонки збігалися з форматом Memora."
                />
                <HelpLine
                  icon={Upload}
                  title="Попередній перегляд"
                  text="Після вибору файлу видно готові рядки, дублікати й помилки. Дані додаються тільки після підтвердження."
                />
                <HelpLine
                  icon={AlertCircle}
                  title="Дублікати"
                  text="Схожі записи за замовчуванням пропускаються. Якщо потрібно, можна явно дозволити додавання схожих матеріалів."
                />
              </div>
            </HelpSubsection>
          </div>
        </HelpSection>

        <HelpSection
          id="help-ratings"
          icon={Gauge}
          kicker="Оцінювання"
          title="Оцінка керує наступною датою повторення."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ratingItems.map((rating) => (
              <div
                key={rating.label}
                className={`rounded-lg border p-4 ${rating.tone}`}
              >
                <p className="font-semibold">{rating.label}</p>
                <p className="mt-2 text-sm leading-6">{rating.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <HelpCard icon={Check} title="Головне правило">
              Оцінюй те, що відбулося зараз: наскільки легко відповідь прийшла з
              пам&apos;яті. Так розклад буде чесним і корисним.
            </HelpCard>
            <HelpCard icon={AlertCircle} title="Коли не треба додавати нове">
              Якщо багато карток отримують «Знову» або «Важко», краще спочатку
              розібрати старі повторення і відредагувати нечіткі формулювання.
            </HelpCard>
          </div>
        </HelpSection>

        <HelpSection
          id="help-progress"
          icon={BarChart3}
          kicker="Прогрес"
          title="Прогрес потрібен для контролю якості, а не для постійного самоконтролю."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {progressItems.map((item) => (
              <HelpCard key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </HelpCard>
            ))}
          </div>
        </HelpSection>

        <HelpSection
          id="help-profile"
          icon={UserCircle}
          kicker="Профіль і дані"
          title="Налаштування винесені з практики, щоб головний екран не відволікав."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profileSettings.map((item) => (
              <HelpCard key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </HelpCard>
            ))}
          </div>
          <HelpSubsection className="mt-4" title="Як зрозуміти, що все йде добре">
            <div className="grid gap-3 md:grid-cols-3">
              <HelpMiniBlock
                title="Черга зменшується"
                text="Після практики кількість карток на сьогодні має падати або ставати нулем."
              />
              <HelpMiniBlock
                title="Помилки зрозумілі"
                text="Ти бачиш, які теми просідають, і можеш відредагувати погані формулювання."
              />
              <HelpMiniBlock
                title="Нові не витісняють повторення"
                text="Краще стабільно повторювати старе, ніж щодня додавати багато нового."
              />
            </div>
          </HelpSubsection>
        </HelpSection>

        <HelpSection
          id="help-map"
          icon={FileText}
          kicker="Карта сервісу"
          title="Що за що відповідає."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sectionItems.map((item) => (
              <HelpCard key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </HelpCard>
            ))}
          </div>
        </HelpSection>
      </div>

      <aside className="order-first xl:sticky xl:top-4 xl:order-none xl:self-start">
        <ShellPanel className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
              <FileText className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Зміст</p>
              <p className="text-xs text-[#9aa8ba]">Перейди до потрібного блоку.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {tocItems.map((item) => (
              <HelpTocLink key={item.href} {...item} />
            ))}
          </div>
        </ShellPanel>
      </aside>
    </div>
  );
}

function HelpSection({
  children,
  icon: Icon,
  id,
  kicker,
  title,
}: {
  children: React.ReactNode;
  icon: IconType;
  id: string;
  kicker: string;
  title: string;
}) {
  return (
    <ShellPanel className="scroll-mt-20 p-4 md:p-5" id={id}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#52e0c4]">{kicker}</p>
          <h2 className="mt-1 text-xl font-semibold leading-tight md:text-2xl">
            {title}
          </h2>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </ShellPanel>
  );
}

function HelpTocLink({
  href,
  icon: Icon,
  text,
  title,
}: {
  href: string;
  icon: IconType;
  text: string;
  title: string;
}) {
  return (
    <a
      className="group flex gap-3 rounded-lg border border-[#263140] bg-[#101923] p-3 transition hover:border-[#2dd4bf] hover:bg-[#13221f]"
      href={href}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#202938] text-[#eef4ff] transition group-hover:bg-[#14352f] group-hover:text-[#52e0c4]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#9aa8ba]">{text}</p>
      </div>
    </a>
  );
}

function HelpCard({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: IconType;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
          <Icon className="size-4" />
        </div>
        <h3 className="min-w-0 font-semibold leading-6">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#9aa8ba]">{children}</p>
    </div>
  );
}

function HelpSubsection({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[#263140] bg-[#0d131c] p-4 ${className}`}
    >
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function HelpStep({
  index,
  text,
  title,
}: {
  index: number;
  text: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <span className="grid size-8 place-items-center rounded-lg bg-[#14352f] font-mono text-xs text-[#52e0c4]">
        {index}
      </span>
      <p className="mt-3 font-semibold leading-6">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#9aa8ba]">{text}</p>
    </div>
  );
}

function HelpMiniBlock({
  text,
  title,
}: {
  text: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#101923] p-3">
      <p className="text-sm font-semibold leading-6">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#9aa8ba]">{text}</p>
    </div>
  );
}

function HelpLine({
  icon: Icon,
  text,
  title,
}: {
  icon: IconType;
  text: string;
  title: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#263140] bg-[#0d131c] p-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#9aa8ba]">{text}</p>
      </div>
    </div>
  );
}
