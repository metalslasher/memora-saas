import { findCloze } from "../cloze";
import { lemmaKey } from "../duplicates";
import { cefrLevels, wordFrequencies, type Cefr, type WordContent, type WordExample, type WordFrequency } from "../types";
import { cleanText, isRecord } from "../word-content";

/**
 * What AI fills for a word (stored as `lexicon.content` / `user_words.content`).
 * Feeds the practice exercises directly: translations → recognition/recall,
 * examples (containing the word) → cloze and listening, accepted/synonyms/
 * forms → answer checking.
 */
export type EnrichedWord = {
  /** The text that was asked for, echoed back to match batch results. */
  input: string;
  /** Dictionary form ("ran" → "run"); phrases keep their base form. */
  lemma: string;
  part_of_speech: PartOfSpeech;
  translations: string[];
  explanation: string;
  examples: Array<Required<WordExample>>;
  accepted: string[];
  synonyms: string[];
  forms: string[];
  cefr: Cefr;
  frequency: WordFrequency;
};

export const partsOfSpeech = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrasal verb",
  "idiom",
  "phrase",
  "preposition",
  "conjunction",
  "pronoun",
  "interjection",
  "other",
] as const;
export type PartOfSpeech = (typeof partsOfSpeech)[number];

export const MAX_BATCH = 20;
export const MAX_INPUT_LENGTH = 60;
const MAX_CONTEXT_LENGTH = 300;

const stringList = { type: "array", items: { type: "string" } } as const;

/** JSON Schema of one word (strict mode: every field required, no extras). */
export const enrichedWordSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "input",
    "lemma",
    "part_of_speech",
    "translations",
    "explanation",
    "examples",
    "accepted",
    "synonyms",
    "forms",
    "cefr",
    "frequency",
  ],
  properties: {
    input: { type: "string" },
    lemma: { type: "string" },
    part_of_speech: { type: "string", enum: [...partsOfSpeech] },
    translations: stringList,
    explanation: { type: "string" },
    examples: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["en", "uk"],
        properties: { en: { type: "string" }, uk: { type: "string" } },
      },
    },
    accepted: stringList,
    synonyms: stringList,
    forms: stringList,
    cefr: { type: "string", enum: [...cefrLevels] },
    frequency: { type: "string", enum: [...wordFrequencies] },
  },
} as const;

export const enrichmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: enrichedWordSchema } },
} as const;

export const enrichmentSystemPrompt = `You write vocabulary cards for Ukrainian speakers learning American English.
For every input word or phrase return one item:
- input: the input exactly as given.
- lemma: the dictionary form ("ran" → "run", "figured out" → "figure out"). Keep phrases and idioms whole. If the input is not English or not a real word, return lemma "" and empty translations.
- part_of_speech: of the main sense.
- translations: 1–4 Ukrainian equivalents a native speaker would actually use, the most common sense first. Translate the meaning, not word by word. Use standard modern Ukrainian only: no Russian or surzhyk words (not "неловкий", "назначати", "вияснити"), no calques. If a context sentence is given, put the sense used there first.
- explanation: one short Ukrainian sentence (max 15 words) on what it means and when people say it.
- examples: 2–3 short everyday sentences (max 14 words) in natural, conversational American English, the way native speakers really talk. Each must contain the lemma itself or one of its forms. uk: a natural Ukrainian translation of the sentence.
- accepted: other correct spellings of the lemma ("OK" → ["okay"]); usually empty.
- synonyms: up to 3 common English synonyms for the main sense; empty if none fit.
- forms: inflected forms (plural, past, past participle, -ing, comparative) that differ from the lemma; empty for phrases that do not change.
- cefr: CEFR level of the main sense.
- frequency: how common it is in everyday American English: high, medium or low.`;

export type EnrichRequest = { input: string; context?: string };

export function enrichmentUserPrompt(requests: EnrichRequest[]) {
  const lines = requests.map((request, index) => {
    const context = request.context ? ` | context: "${request.context}"` : "";
    return `${index + 1}. ${request.input}${context}`;
  });
  return `Inputs:\n${lines.join("\n")}`;
}

/** Cleans what the user typed or tapped; empty when unusable. */
export function cleanEnrichInput(value: unknown) {
  const text = cleanText(value).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!text || text.length > MAX_INPUT_LENGTH || !/\p{Script=Latin}/u.test(text)) return "";
  return text;
}

export function cleanEnrichContext(value: unknown) {
  return cleanText(value).slice(0, MAX_CONTEXT_LENGTH);
}

function list(value: unknown, max: number, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = cleanText(item);
    if (!text || text.length > maxLength || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length >= max) break;
  }
  return result;
}

/**
 * Validates one model item. Returns null when it is unusable (no lemma or no
 * translation). Examples that contain the word come first so the cloze
 * exercise can be built from the first one.
 */
export function parseEnrichedWord(raw: unknown): EnrichedWord | null {
  if (!isRecord(raw)) return null;
  const lemma = cleanText(raw.lemma).slice(0, 200);
  const translations = list(raw.translations, 4);
  if (!lemma || translations.length === 0) return null;

  const examples = (Array.isArray(raw.examples) ? raw.examples : [])
    .filter(isRecord)
    .map((item) => ({ en: cleanText(item.en).slice(0, 300), uk: cleanText(item.uk).slice(0, 300) }))
    .filter((item) => item.en && item.uk)
    .slice(0, 3);
  examples.sort((a, b) => Number(findCloze(lemma, b.en) !== null) - Number(findCloze(lemma, a.en) !== null));

  const key = lemmaKey(lemma);
  return {
    input: cleanText(raw.input),
    lemma,
    part_of_speech: partsOfSpeech.find((value) => value === raw.part_of_speech) ?? "other",
    translations,
    explanation: cleanText(raw.explanation).slice(0, 300),
    examples,
    accepted: list(raw.accepted, 5).filter((item) => lemmaKey(item) !== key),
    synonyms: list(raw.synonyms, 3).filter((item) => lemmaKey(item) !== key),
    forms: list(raw.forms, 8, 40).filter((item) => lemmaKey(item) !== key),
    cefr: cefrLevels.find((value) => value === raw.cefr) ?? "B1",
    frequency: wordFrequencies.find((value) => value === raw.frequency) ?? "medium",
  };
}

/**
 * Matches model items to the requests (by echoed input, then by position) and
 * validates them. Missing or invalid items are null.
 */
export function parseEnrichment(raw: unknown, requests: EnrichRequest[]): Array<EnrichedWord | null> {
  const items = isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
  const parsed = items.map(parseEnrichedWord);
  const byInput = new Map<string, EnrichedWord>();
  for (const item of parsed) if (item) byInput.set(lemmaKey(item.input), item);

  return requests.map((request, index) => {
    const match = byInput.get(lemmaKey(request.input));
    if (match) return match;
    const positional = parsed[index];
    return positional && !byInput.has(lemmaKey(positional.input)) ? positional : null;
  });
}

export function contentFromEnriched(word: EnrichedWord): WordContent {
  const content: WordContent = {
    translations: word.translations,
    part_of_speech: word.part_of_speech,
    examples: word.examples,
    explanation: word.explanation || undefined,
    cefr: word.cefr,
    frequency: word.frequency,
  };
  if (!content.explanation) delete content.explanation;
  if (word.accepted.length > 0) content.accepted = word.accepted;
  if (word.synonyms.length > 0) content.synonyms = word.synonyms;
  if (word.forms.length > 0) content.forms = word.forms;
  return content;
}

/** Rough token estimate of a request, to reserve budget before the call. */
export function estimateEnrichmentTokens(requests: EnrichRequest[]) {
  const promptChars = enrichmentSystemPrompt.length + JSON.stringify(enrichmentSchema).length;
  const input = Math.ceil((promptChars + enrichmentUserPrompt(requests).length) / 4);
  // ~350 tokens of JSON per word, plus headroom for reasoning tokens.
  const output = 400 + requests.length * 450;
  return { input, output };
}
