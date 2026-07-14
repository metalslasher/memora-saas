import type { GeneratedCardTemplate } from "./card-generator";
import type { ModuleType, Note } from "./types";

export type StarterNote = {
  key: string;
  module: ModuleType;
  title: string;
  tags: string[];
  content: Note["content"];
};

export type StarterCard = GeneratedCardTemplate & {
  key: string;
  noteKey: string;
  scheduledDays?: number;
};

export const starterNotes: StarterNote[] = [
  {
    key: "bug",
    module: "english",
    title: "bug",
    tags: ["english", "qa", "work"],
    content: {
      lemma_en: "bug",
      translation_uk: "помилка в програмі",
      part_of_speech: "noun",
      example_en: "I found a bug in the checkout flow.",
    },
  },
  {
    key: "handoff",
    module: "english",
    title: "handoff",
    tags: ["english", "meetings", "work"],
    content: {
      lemma_en: "handoff",
      translation_uk: "передача задачі або контексту іншій людині",
      part_of_speech: "noun",
      example_en: "Let's write a short handoff before the release.",
    },
  },
  {
    key: "edge-case",
    module: "english",
    title: "edge case",
    tags: ["english", "qa", "product"],
    content: {
      lemma_en: "edge case",
      translation_uk: "рідкісний або крайній випадок",
      part_of_speech: "phrase",
      example_en: "This edge case breaks the validation logic.",
    },
  },
  {
    key: "regression-testing",
    module: "qa",
    title: "Regression testing",
    tags: ["qa", "fundamentals", "interview"],
    content: {
      term: "Regression testing",
      short_definition:
        "Перевірка, що вже працюючий функціонал не зламався після змін у коді, конфігурації або даних.",
      example:
        "Після фікса checkout треба прогнати payment і cart тести, щоб не зламати стару поведінку.",
    },
  },
  {
    key: "boundary-value-analysis",
    module: "qa",
    title: "Boundary value analysis",
    tags: ["qa", "test-design", "interview"],
    content: {
      term: "Boundary value analysis",
      short_definition:
        "Техніка тест-дизайну, де перевіряють значення на межах діапазону і поруч із ними.",
      example: "Для поля 1-100 перевір 0, 1, 2, 99, 100 і 101.",
    },
  },
  {
    key: "user-facing-locators",
    module: "qa",
    title: "User-facing locators",
    tags: ["qa", "automation", "playwright"],
    content: {
      term: "User-facing locators",
      short_definition:
        "Локатори, які шукають елементи так, як їх сприймає користувач: за роллю, текстом, label або доступною назвою.",
      example: "Краще getByRole('button', { name: 'Save' }), ніж крихкий CSS selector.",
    },
  },
];

export const starterCards: StarterCard[] = [
  {
    key: "bug-productive",
    noteKey: "bug",
    module: "english",
    type: "productive_translation",
    priority: 100,
    prompt: "Як сказати англійською: помилка в програмі?",
    answer: "bug",
    explanation:
      "Bug означає дефект у програмі. Issue ширше: це може бути задача, проблема або тема для обговорення.",
    example: "I found a bug in the checkout flow.",
    tags: ["english", "qa", "work"],
    scheduledDays: 2,
  },
  {
    key: "bug-cloze",
    noteKey: "bug",
    module: "english",
    type: "cloze_context",
    priority: 95,
    prompt: "I found a ___ in the checkout flow.",
    answer: "bug",
    explanation:
      "У цьому реченні бракує слова для дефекту в програмі або поведінці продукту.",
    example: "I found a bug in the checkout flow.",
    tags: ["english", "qa", "work"],
  },
  {
    key: "handoff-productive",
    noteKey: "handoff",
    module: "english",
    type: "productive_translation",
    priority: 90,
    prompt: "Як англійською назвати передачу задачі або контексту іншій людині?",
    answer: "handoff",
    explanation:
      "Handoff - це передача контексту, відповідальності або роботи іншій людині чи команді.",
    example: "Let's write a short handoff before the release.",
    tags: ["english", "meetings", "work"],
  },
  {
    key: "edge-case-productive",
    noteKey: "edge-case",
    module: "english",
    type: "productive_translation",
    priority: 88,
    prompt: "Як сказати англійською: рідкісний або крайній випадок?",
    answer: "edge case",
    explanation:
      "Edge case - це незвична ситуація на межі очікуваної поведінки системи.",
    example: "This edge case breaks the validation logic.",
    tags: ["english", "qa", "product"],
  },
  {
    key: "regression-definition",
    noteKey: "regression-testing",
    module: "qa",
    type: "term_definition",
    priority: 100,
    prompt: "Поясни українською: що таке Regression testing?",
    answer:
      "Перевірка, що вже працюючий функціонал не зламався після змін у коді, конфігурації або даних.",
    explanation:
      "Regression testing захищає стару робочу поведінку від випадкових поломок після змін.",
    example:
      "Після фікса checkout треба прогнати payment і cart тести, щоб не зламати стару поведінку.",
    tags: ["qa", "fundamentals", "interview"],
    scheduledDays: 4,
  },
  {
    key: "bva-definition",
    noteKey: "boundary-value-analysis",
    module: "qa",
    type: "term_definition",
    priority: 92,
    prompt: "Поясни українською: що таке Boundary value analysis?",
    answer:
      "Техніка тест-дизайну, де перевіряють значення на межах діапазону і поруч із ними.",
    explanation:
      "Баги часто з'являються саме на межах дозволених значень, тому такі перевірки дають багато користі.",
    example: "Для поля 1-100 перевір 0, 1, 2, 99, 100 і 101.",
    tags: ["qa", "test-design", "interview"],
  },
  {
    key: "regression-vs-confirmation",
    noteKey: "regression-testing",
    module: "qa",
    type: "contrast",
    priority: 88,
    prompt: "Regression testing vs confirmation testing: у чому ключова різниця?",
    answer:
      "Confirmation testing перевіряє, що конкретний fix спрацював. Regression testing перевіряє, що інша вже робоча поведінка не зламалась після зміни.",
    explanation:
      "Confirmation testing вузько дивиться на виправлений дефект. Regression testing ширше дивиться на ризик побічних поломок.",
    tags: ["qa", "fundamentals", "interview"],
  },
  {
    key: "playwright-locators-scenario",
    noteKey: "user-facing-locators",
    module: "qa",
    type: "scenario",
    priority: 86,
    prompt:
      "Playwright тест шукає '.primary-btn:nth-child(2)' і ламається після невеликого UI refactor. Який стиль локатора краще обрати?",
    answer:
      "Краще user-facing locator: getByRole(), getByLabel() або getByText(), якщо він відповідає наміру тесту.",
    explanation:
      "User-facing locators зазвичай стабільніші, бо спираються на роль, текст або доступну назву, а не на крихку DOM-структуру.",
    example: "page.getByRole('button', { name: 'Save' })",
    tags: ["qa", "automation", "playwright"],
  },
];
