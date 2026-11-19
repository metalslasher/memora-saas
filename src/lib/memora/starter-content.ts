import type { WordContent } from "./types";

export type StarterWord = { lemma: string; content: WordContent };

/**
 * A small everyday/work starter set for brand-new accounts, so practice is
 * not empty until the curriculum arrives (batch 4).
 */
export const starterWords: StarterWord[] = [
  {
    lemma: "figure out",
    content: {
      translations: ["розібратися", "зрозуміти"],
      part_of_speech: "phrasal verb",
      examples: [
        {
          en: "I'm still trying to figure out how this works.",
          uk: "Я досі намагаюся розібратися, як це працює.",
        },
      ],
    },
  },
  {
    lemma: "follow up",
    content: {
      translations: ["нагадати про себе", "повернутися до питання"],
      part_of_speech: "phrasal verb",
      examples: [
        {
          en: "I'll follow up with them tomorrow if I don't hear back.",
          uk: "Якщо вони не відповідуть, я завтра їм нагадаю.",
        },
      ],
    },
  },
  {
    lemma: "reliable",
    content: {
      translations: ["надійний"],
      part_of_speech: "adjective",
      examples: [
        { en: "We need a more reliable way to track this.", uk: "Нам потрібен надійніший спосіб це відстежувати." },
      ],
    },
  },
  {
    lemma: "get used to",
    content: {
      translations: ["звикнути до"],
      part_of_speech: "phrase",
      examples: [
        { en: "You'll get used to it after a week or two.", uk: "Ти звикнеш за тиждень-два." },
      ],
    },
  },
  {
    lemma: "by the way",
    content: {
      translations: ["до речі"],
      part_of_speech: "phrase",
      examples: [
        { en: "By the way, did you see Sarah's email?", uk: "До речі, ти бачив лист від Сари?" },
      ],
    },
  },
  {
    lemma: "deadline",
    content: {
      translations: ["дедлайн", "кінцевий термін"],
      part_of_speech: "noun",
      examples: [
        { en: "The deadline got pushed to Friday.", uk: "Дедлайн перенесли на п’ятницю." },
      ],
    },
  },
  {
    lemma: "handle",
    content: {
      translations: ["впоратися з", "взяти на себе"],
      part_of_speech: "verb",
      examples: [
        { en: "Can you handle this while I'm out?", uk: "Можеш узяти це на себе, поки мене не буде?" },
      ],
    },
  },
  {
    lemma: "available",
    content: {
      translations: ["вільний", "доступний"],
      part_of_speech: "adjective",
      examples: [
        { en: "Are you available for a quick call at three?", uk: "Ти вільний о третій на коротку розмову?" },
      ],
    },
  },
  {
    lemma: "look forward to",
    content: {
      translations: ["чекати з нетерпінням"],
      part_of_speech: "phrase",
      examples: [
        { en: "I'm really looking forward to the weekend.", uk: "Я дуже чекаю на вихідні." },
      ],
    },
  },
  {
    lemma: "come up with",
    content: {
      translations: ["придумати", "вигадати"],
      part_of_speech: "phrasal verb",
      examples: [
        { en: "We need to come up with a better plan.", uk: "Нам треба придумати кращий план." },
      ],
    },
  },
];
