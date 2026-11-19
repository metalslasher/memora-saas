"use client";

import { AlertCircle, Check, ChevronDown, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { unwrap } from "@/lib/memora/actions/result";
import { addWordAction, updateWordAction } from "@/lib/memora/actions/words";
import { cardKindLabels, defaultCardKinds, renderCard } from "@/lib/memora/card-render";
import { findSimilarWords } from "@/lib/memora/duplicates";
import type { WordDraft, WordListItem } from "@/lib/memora/types";
import { contentFromDraft, normalizeWordDraft, wordDraftErrors } from "@/lib/memora/word-content";
import { useShell } from "../app-shell";
import { Button, TextInput } from "../shared-ui";

const emptyDraft: WordDraft = { lemma: "", translation: "", partOfSpeech: "", example: "" };

export function AddWordForm({
  words,
  onAdded,
}: {
  words: WordListItem[];
  onAdded: (word: WordListItem) => void;
}) {
  const router = useRouter();
  const { showError, showToast } = useShell();
  const [draft, setDraft] = useState<WordDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowSimilar, setAllowSimilar] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const normalized = useMemo(() => normalizeWordDraft(draft), [draft]);
  const canSubmit = wordDraftErrors(normalized).length === 0;
  const similar = useMemo(() => findSimilarWords(words, normalized.lemma), [normalized.lemma, words]);
  const previews = useMemo(() => {
    if (!canSubmit) return [];
    const content = contentFromDraft(normalized);
    return defaultCardKinds.map((kind) => ({ kind, ...renderCard(kind, normalized.lemma, content) }));
  }, [canSubmit, normalized]);
  const isBlocked = similar.exact !== null || (similar.close.length > 0 && !allowSimilar);
  const submitDisabled = !canSubmit || isBlocked || isSubmitting;

  function update(patch: Partial<WordDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    if (patch.lemma !== undefined) setAllowSimilar(false);
  }

  async function submit() {
    if (submitDisabled) return;
    setIsSubmitting(true);
    try {
      const word = unwrap(await addWordAction(normalized));
      onAdded(word);
      setDraft(emptyDraft);
      setAllowSimilar(false);
      setAdded((current) => [word.lemma, ...current].slice(0, 6));
      setFormKey((value) => value + 1);
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Applies the typed translation/example to the word that already exists. */
  async function updateExisting() {
    if (!similar.exact || !canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      unwrap(await updateWordAction(similar.exact.id, { ...normalized, lemma: similar.exact.lemma }));
      showToast("success", "Слово оновлено.");
      router.push(`/app/words/${similar.exact.id}`);
    } catch (error) {
      showError(error);
      setIsSubmitting(false);
    }
  }

  const blocking = similar.exact ? [similar.exact] : allowSimilar ? [] : similar.close;

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div key={formKey} className="space-y-4">
        <TextInput
          autoComplete="off"
          autoFocus
          label="Англійською"
          placeholder="figure out"
          value={draft.lemma}
          onChange={(lemma) => update({ lemma })}
        />
        <TextInput
          autoComplete="off"
          hint="кілька варіантів — через кому"
          label="Переклад"
          placeholder="розібратися, зрозуміти"
          value={draft.translation}
          onChange={(translation) => update({ translation })}
        />
        <TextInput
          autoComplete="off"
          hint="необов’язково"
          label="Приклад речення"
          placeholder="I'm still trying to figure it out."
          value={draft.example ?? ""}
          onChange={(example) => update({ example })}
        />
      </div>

      {blocking.length > 0 ? (
        <div className="rounded-2xl border border-amber/30 bg-amber-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber">
            <AlertCircle className="size-4" />
            {similar.exact ? "Це слово вже є:" : "Схоже слово вже є:"} {blocking.map((word) => word.lemma).join(", ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.push(`/app/words/${blocking[0].id}`)}>
              Відкрити
            </Button>
            {similar.exact ? (
              <Button size="sm" variant="soft" disabled={!canSubmit || isSubmitting} onClick={() => void updateExisting()}>
                Оновити наявне
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setAllowSimilar(true)}>
                Додати все одно
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {previews.length > 0 ? (
        <details className="group rounded-2xl border border-line bg-surface-1">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-text-2 [&::-webkit-details-marker]:hidden">
            <Sparkles className="size-4 text-accent" />
            Буде створено {previews.length} картки
            <ChevronDown className="ml-auto size-4 text-faint transition group-open:rotate-180" />
          </summary>
          <div className="space-y-2 px-4 pb-4">
            {previews.map((card) => (
              <div key={card.kind} className="rounded-xl border border-line bg-surface-2 p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                  {cardKindLabels[card.kind]} · {card.instruction}
                </p>
                <p className="mt-1 text-sm text-text">{card.cue}</p>
                <p className="mt-1 text-sm text-accent">{card.answer}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <Button
        className="w-full"
        disabled={submitDisabled}
        icon={Plus}
        isLoading={isSubmitting}
        size="lg"
        type="submit"
        variant="primary"
      >
        Додати
      </Button>

      {added.length > 0 ? (
        <div className="animate-rise rounded-2xl border border-accent/20 bg-accent-soft/60 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-accent">
            <Check className="size-4" />
            Додано. Можна вводити наступне.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {added.map((lemma, index) => (
              <span key={`${lemma}-${index}`} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-2">
                {lemma}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
