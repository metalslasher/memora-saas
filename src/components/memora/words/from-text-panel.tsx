"use client";

import { ArrowLeft, Check, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { enrichPickedWordsAction } from "@/lib/memora/actions/ai";
import { unwrap } from "@/lib/memora/actions/result";
import { addPickedWordsAction } from "@/lib/memora/actions/words";
import { MAX_BATCH } from "@/lib/memora/ai/enrichment";
import type { AiStatus, EnrichedDraft } from "@/lib/memora/ai/service";
import { lemmaKey } from "@/lib/memora/duplicates";
import { isKnownWord, knownWordForms, MAX_TEXT_LENGTH, pickedPhrases, tokenizeText } from "@/lib/memora/text-pick";
import type { WordListItem } from "@/lib/memora/types";
import { useShell } from "../app-shell";
import { Button, TextArea } from "../shared-ui";
import { plural } from "../utils";

type Step = "paste" | "pick" | "review";
type Draft = { input: string; result: EnrichedDraft | null; include: boolean; duplicate: boolean };

/**
 * "From a text": paste a paragraph, tap the words you do not know (adjacent
 * taps make a phrase), AI fills them in one request, review, add.
 */
export function FromTextPanel({
  ai,
  words,
  onAdded,
}: {
  ai: AiStatus;
  words: WordListItem[];
  onAdded: (words: WordListItem[]) => void;
}) {
  const { showError, showToast } = useShell();
  const [step, setStep] = useState<Step>("paste");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const tokens = useMemo(() => tokenizeText(text), [text]);
  const known = useMemo(() => knownWordForms(words.map((word) => word.lemma)), [words]);
  const libraryKeys = useMemo(() => new Set(words.map((word) => lemmaKey(word.lemma))), [words]);
  const phrases = useMemo(() => pickedPhrases(tokens, selected), [tokens, selected]);
  const isFull = phrases.length >= MAX_BATCH;
  const included = drafts.filter((draft) => draft.include && draft.result && !draft.duplicate);

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else if (!isFull) next.add(index);
      return next;
    });
  }

  async function enrich() {
    if (phrases.length === 0 || isBusy) return;
    setIsBusy(true);
    try {
      const results = unwrap(
        await enrichPickedWordsAction(phrases.map(({ input, context }) => ({ input, context }))),
      );
      setDrafts(
        phrases.map((phrase, index) => {
          const result = results[index] ?? null;
          const duplicate = result ? libraryKeys.has(lemmaKey(result.lemma)) : false;
          return { input: phrase.input, result, include: Boolean(result) && !duplicate, duplicate };
        }),
      );
      setStep("review");
    } catch (error) {
      showError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function add() {
    if (included.length === 0 || isBusy) return;
    setIsBusy(true);
    try {
      const result = unwrap(
        await addPickedWordsAction(
          included.map(({ result }) => ({
            lemma: result!.lemma,
            content: result!.content,
            lexiconId: result!.lexiconId,
          })),
        ),
      );
      onAdded(result.imported);
      showToast("success", `Додано ${plural(result.imported.length, ["слово", "слова", "слів"])}.`);
      setSelected(new Set());
      setDrafts([]);
      setStep("pick");
    } catch (error) {
      showError(error);
    } finally {
      setIsBusy(false);
    }
  }

  if (step === "paste") {
    return (
      <div className="space-y-4 p-5">
        {ai.blockedMessage ? <Notice>{ai.blockedMessage}</Notice> : null}
        <TextArea
          autoFocus
          hint={`${text.length}/${MAX_TEXT_LENGTH}`}
          label="Текст англійською"
          placeholder="Встав абзац зі статті, листа чи субтитрів…"
          rows={7}
          value={text}
          onChange={(value) => setText(value.slice(0, MAX_TEXT_LENGTH))}
        />
        <Button
          className="w-full"
          disabled={!tokens.some((token) => token.isWord)}
          size="lg"
          variant="primary"
          onClick={() => {
            setSelected(new Set());
            setStep("pick");
          }}
        >
          Далі — обрати слова
        </Button>
      </div>
    );
  }

  if (step === "pick") {
    return (
      <div className="flex min-h-0 flex-col">
        <div className="space-y-3 overflow-y-auto p-5 pb-3">
          {ai.blockedMessage ? <Notice>{ai.blockedMessage}</Notice> : null}
          <p className="text-sm text-text-2">
            Тапни слова, яких не знаєш. Сусідні слова стануть фразою. Бліді — уже є у твоїх словах.
          </p>
          <p className="whitespace-pre-wrap rounded-2xl border border-line bg-surface-1 p-4 text-[17px] leading-9 text-text">
            {tokens.map((token, index) => {
              if (!token.isWord) return <span key={index}>{token.text}</span>;
              const isKnown = isKnownWord(token.text, known);
              const isSelected = selected.has(index);
              return (
                <button
                  key={index}
                  aria-pressed={isSelected}
                  className={`rounded-md px-0.5 transition ${
                    isSelected
                      ? "bg-accent text-white"
                      : isKnown
                        ? "text-faint"
                        : "hover:bg-accent-soft active:bg-accent-soft"
                  }`}
                  disabled={isKnown && !isSelected}
                  type="button"
                  onClick={() => toggle(index)}
                >
                  {token.text}
                </button>
              );
            })}
          </p>
        </div>
        <div className="space-y-3 border-t border-line bg-surface-2 p-4">
          {phrases.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {phrases.map((phrase) => (
                <span key={phrase.input} className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                  {phrase.input}
                </span>
              ))}
              {isFull ? <span className="text-xs text-faint">максимум {MAX_BATCH} за раз</span> : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button icon={ArrowLeft} variant="ghost" onClick={() => setStep("paste")}>
              Текст
            </Button>
            <Button
              className="flex-1"
              disabled={phrases.length === 0 || Boolean(ai.blockedMessage)}
              icon={Sparkles}
              isLoading={isBusy}
              variant="primary"
              onClick={() => void enrich()}
            >
              Заповнити з AI{phrases.length > 0 ? ` · ${phrases.length}` : ""}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <ul className="divide-y divide-line overflow-y-auto">
        {drafts.map((draft, index) => {
          const content = draft.result?.content;
          return (
            <li key={draft.input} className="flex items-start gap-3 px-5 py-3">
              <button
                aria-label={draft.include ? "Не додавати" : "Додати"}
                aria-pressed={draft.include}
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition disabled:opacity-40 ${
                  draft.include ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
                }`}
                disabled={!draft.result || draft.duplicate}
                type="button"
                onClick={() =>
                  setDrafts((current) =>
                    current.map((item, position) => (position === index ? { ...item, include: !item.include } : item)),
                  )
                }
              >
                <Check className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-text">{draft.result?.lemma ?? draft.input}</span>
                  {content ? <span className="text-text-2"> — {content.translations.join(", ")}</span> : null}
                </p>
                {content?.examples[0] ? (
                  <p className="mt-0.5 truncate text-xs text-faint">{content.examples[0].en}</p>
                ) : null}
                {!draft.result ? (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-faint">
                    <X className="size-3" /> AI не впізнав це слово — пропущено
                  </p>
                ) : draft.duplicate ? (
                  <p className="mt-0.5 text-xs text-faint">Уже є у твоїх словах</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 border-t border-line bg-surface-2 p-4">
        <Button icon={ArrowLeft} variant="ghost" onClick={() => setStep("pick")}>
          Назад
        </Button>
        <Button
          className="flex-1"
          disabled={included.length === 0}
          icon={Plus}
          isLoading={isBusy}
          variant="primary"
          onClick={() => void add()}
        >
          Додати {plural(included.length, ["слово", "слова", "слів"])}
        </Button>
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-surface-3 px-3 py-2 text-xs leading-5 text-text-2">{children}</p>;
}
