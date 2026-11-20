"use client";

import { ArrowLeft, BookOpenCheck, PauseCircle, PlayCircle, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setCardStatusAction } from "@/lib/memora/actions/practice";
import { unwrap } from "@/lib/memora/actions/result";
import { deleteWordAction, setWordStatusAction, updateWordAction } from "@/lib/memora/actions/words";
import { cardKindLabels, renderCard } from "@/lib/memora/card-render";
import { lockedKinds } from "@/lib/memora/exercise-unlock";
import type { WordCard, WordContent, WordDetail, WordDraft } from "@/lib/memora/types";
import { draftFromContent, normalizeWordDraft, wordDraftErrors } from "@/lib/memora/word-content";
import { useShell } from "../app-shell";
import { Badge, Button, ShellPanel, TextArea, TextInput } from "../shared-ui";
import { SpeakButton } from "../speech";
import { useFreshSnapshot } from "../use-fresh-snapshot";
import { formatDate, wordSourceLabels } from "../utils";

export function WordDetailView({
  focusField,
  initialWord,
  snapshot,
}: {
  /** Field to focus when opened from the practice "hard word" panel. */
  focusField: "translation" | "example" | null;
  initialWord: WordDetail;
  snapshot: string;
}) {
  useFreshSnapshot(snapshot);
  const router = useRouter();
  const { showError, showToast } = useShell();
  const [word, setWord] = useState(initialWord);
  const [isBusy, setIsBusy] = useState(false);
  const isActive = word.status === "active";
  const accuracy =
    word.reviews.total > 0 ? Math.round((word.reviews.correct / word.reviews.total) * 100) : null;

  async function run(task: () => Promise<void>) {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await task();
    } catch (error) {
      showError(error);
    } finally {
      setIsBusy(false);
    }
  }

  function save(draft: WordDraft) {
    return run(async () => {
      const updated = unwrap(await updateWordAction(word.id, draft));
      setWord((current) => ({ ...current, ...updated }));
      showToast("success", "Зміни збережено.");
    });
  }

  function toggleStatus() {
    const status = isActive ? "paused" : "active";
    return run(async () => {
      unwrap(await setWordStatusAction(word.id, status));
      setWord((current) => ({ ...current, status }));
      showToast("success", status === "paused" ? "Слово на паузі — у практиці його не буде." : "Слово знову в навчанні.");
    });
  }

  function toggleCard(card: WordCard) {
    const status = card.status === "active" ? "paused" : "active";
    return run(async () => {
      unwrap(await setCardStatusAction(card.id, status));
      setWord((current) => ({
        ...current,
        cards: current.cards.map((item) => (item.id === card.id ? { ...item, status } : item)),
      }));
    });
  }

  function remove() {
    if (!window.confirm(`Видалити «${word.lemma}» разом із картками та історією повторень?`)) return;
    return run(async () => {
      unwrap(await deleteWordAction(word.id));
      showToast("success", "Слово видалено.");
      router.push("/app/words");
    });
  }

  return (
    <div className="space-y-5">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-text"
        href="/app/words"
      >
        <ArrowLeft className="size-4" />
        Усі слова
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-[28px]" lang="en">
            {word.lemma}
            <SpeakButton text={word.lemma} />
          </h1>
          <p className="mt-1 text-sm text-muted">
            {wordSourceLabels[word.source]} · {formatDate(word.createdAt)}
            {accuracy !== null ? ` · ${word.reviews.total} відповідей, згадано ${accuracy}%` : ""}
          </p>
        </div>
        {!isActive ? <Badge tone="neutral">на паузі</Badge> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <ShellPanel className="p-5 md:p-6">
          <WordEditForm
            key={`${word.lemma}:${JSON.stringify(word.content)}`}
            content={word.content}
            focusField={focusField}
            isBusy={isBusy}
            lemma={word.lemma}
            onSave={save}
          />
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            <Button disabled={isBusy} icon={isActive ? PauseCircle : PlayCircle} size="sm" onClick={() => void toggleStatus()}>
              {isActive ? "Поставити на паузу" : "Повернути в навчання"}
            </Button>
            <Button disabled={isBusy} icon={Trash2} size="sm" variant="danger" onClick={() => void remove()}>
              Видалити
            </Button>
          </div>
        </ShellPanel>

        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-2">
            <BookOpenCheck className="size-4 text-accent" />
            Вправи
          </h2>
          <div className="mt-3 space-y-2.5">
            {word.cards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                content={word.content}
                isBusy={isBusy}
                lemma={word.lemma}
                onToggle={() => void toggleCard(card)}
              />
            ))}
          </div>
          <LockedExercises word={word} />
        </section>
      </div>
    </div>
  );
}

function LockedExercises({ word }: { word: WordDetail }) {
  const locked = lockedKinds(
    word.cards.map((card) => card.kind),
    word.lemma,
    word.content,
  );
  if (locked.length === 0) return null;
  return (
    <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-3 text-xs leading-5 text-muted">
      Згодом відкриються: {locked.map((kind) => cardKindLabels[kind]).join(", ")}. Нові вправи з’являються, коли
      попередню вже добре знаєш.
    </p>
  );
}

function WordEditForm({
  content,
  focusField,
  isBusy,
  lemma,
  onSave,
}: {
  content: WordContent;
  focusField: "translation" | "example" | null;
  isBusy: boolean;
  lemma: string;
  onSave: (draft: WordDraft) => Promise<void>;
}) {
  const initial = draftFromContent(lemma, content);
  const [draft, setDraft] = useState<WordDraft>(initial);
  const normalized = normalizeWordDraft(draft);
  const hasChanges = JSON.stringify(normalized) !== JSON.stringify(normalizeWordDraft(initial));
  const canSave = wordDraftErrors(normalized).length === 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave && hasChanges && !isBusy) void onSave(normalized);
      }}
    >
      <TextInput label="Англійською" value={draft.lemma} onChange={(value) => setDraft((d) => ({ ...d, lemma: value }))} />
      <TextInput
        autoFocus={focusField === "translation"}
        hint="варіанти — через кому"
        label="Переклад"
        value={draft.translation}
        onChange={(value) => setDraft((d) => ({ ...d, translation: value }))}
      />
      <TextInput
        hint="noun, verb, phrase…"
        label="Частина мови"
        value={draft.partOfSpeech ?? ""}
        onChange={(value) => setDraft((d) => ({ ...d, partOfSpeech: value }))}
      />
      <TextArea
        autoFocus={focusField === "example"}
        hint="з цього речення будується вправа з пропуском"
        label="Приклад речення"
        rows={2}
        value={draft.example ?? ""}
        onChange={(value) => setDraft((d) => ({ ...d, example: value }))}
      />
      <TextInput
        hint="інше написання чи форма, через кому"
        label="Теж правильно"
        placeholder="okay, OK"
        value={draft.accepted ?? ""}
        onChange={(value) => setDraft((d) => ({ ...d, accepted: value }))}
      />
      <TextInput
        hint="зарахуємо, але підкажемо, яке слово вчимо"
        label="Синоніми"
        placeholder="dependable, trustworthy"
        value={draft.synonyms ?? ""}
        onChange={(value) => setDraft((d) => ({ ...d, synonyms: value }))}
      />
      <Button disabled={!canSave || !hasChanges || isBusy} icon={Save} type="submit" variant="primary">
        Зберегти зміни
      </Button>
      {hasChanges ? <p className="text-xs text-faint">Вправи оновляться, прогрес повторень збережеться.</p> : null}
    </form>
  );
}

function CardRow({
  card,
  content,
  isBusy,
  lemma,
  onToggle,
}: {
  card: WordCard;
  content: WordContent;
  isBusy: boolean;
  lemma: string;
  onToggle: () => void;
}) {
  const [now] = useState(() => Date.now());
  const view = renderCard(card.kind, lemma, content);
  const isPaused = card.status !== "active";
  const isDue = Date.parse(card.schedule.due) <= now;

  return (
    <div className={`rounded-xl border border-line bg-surface-1 p-4 ${isPaused ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
          {cardKindLabels[card.kind]}
        </span>
        <span className="text-xs text-muted">
          {isPaused
            ? "на паузі"
            : card.schedule.reps === 0
              ? "ще не вивчалась"
              : isDue
                ? "пора повторити"
                : `далі: ${formatDate(card.schedule.due)}`}
        </span>
      </div>
      <p className="mt-2 text-xs text-faint">{view.instruction}</p>
      <p className="mt-0.5 text-sm font-medium text-text">{view.cue || view.audio}</p>
      <p className="mt-1 text-sm text-accent">{view.answer}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-faint">
          повторень: {card.schedule.reps} · помилок: {card.schedule.lapses}
        </span>
        <Button disabled={isBusy} icon={isPaused ? PlayCircle : PauseCircle} size="sm" variant="ghost" onClick={onToggle}>
          {isPaused ? "Повернути" : "Пауза"}
        </Button>
      </div>
    </div>
  );
}
