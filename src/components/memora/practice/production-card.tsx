"use client";

import { AlertTriangle, Check, Loader2, Mic, MicOff, RotateCcw, SkipForward, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { checkSentenceAction, checkSpeechAction, type ProductionCheck } from "@/lib/memora/actions/production";
import { cardKindLabels } from "@/lib/memora/card-render";
import {
  MAX_RECORDING_SECONDS,
  MAX_SENTENCE_LENGTH,
  sentenceIdea,
  type SentenceFeedback,
} from "@/lib/memora/production";
import type { CardKind, PracticeCard, ReviewRating } from "@/lib/memora/types";
import { translationText } from "@/lib/memora/word-content";
import { Button, Kbd } from "../shared-ui";
import { prefetchEnglish, SpeakButton } from "../speech";
import { formatError } from "../utils";
import { AutoRating, CardTopBar, cardShellClass, ratingIntervals } from "./study-card";
import type { PracticeSession } from "./use-practice-session";

function subscribe() {
  return () => undefined;
}

/** Whether this browser can record audio (MediaRecorder + getUserMedia). */
export function useRecordingSupported() {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function",
    () => false,
  );
}

type Problem =
  | { type: "error"; message: string }
  | { type: "blocked"; message: string; kinds: CardKind[] }
  | { type: "mic"; message: string }
  | { type: "silent" };

type Phase =
  | { step: "input" }
  | { step: "recording"; startedAt: number }
  | { step: "checking" }
  | { step: "feedback"; result: Extract<ProductionCheck, { status: "ok" }> };

const recorderTypes = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

const verdictMeta: Record<SentenceFeedback["verdict"], { label: string; className: string }> = {
  good: { label: "Добре", className: "bg-accent-soft text-accent" },
  minor: { label: "Слово вжито правильно, є помилки", className: "bg-amber-soft text-amber" },
  wrong: { label: "Слово вжито неправильно", className: "bg-danger-soft text-danger" },
};

function micProblem(error: unknown): Problem {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      type: "mic",
      message:
        "Немає доступу до мікрофона. Дозволь його для цього сайту (значок біля адреси → Дозволи) або вимкни «Говоріння» в Профілі.",
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { type: "mic", message: "Мікрофон не знайдено. Підключи його або пропусти цю вправу." };
  }
  return { type: "mic", message: "Не вдалося ввімкнути мікрофон. Спробуй ще раз або пропусти вправу." };
}

/**
 * "Своє речення" and "Скажи вголос": the learner writes or says a sentence
 * with the word, the server returns AI feedback and a suggested rating
 * (production.ts), the learner may change it — like the auto-grade of typed
 * answers. Problems (no microphone, AI limit, a failed call) never block the
 * practice: each has a way to skip.
 */
export function ProductionCardView({ card, practice }: { card: PracticeCard; practice: PracticeSession }) {
  const { responseText, setResponseText, grade, reveal, skip, skipKinds, pause, canUndo, undo } = practice;
  const isSpeaking = card.kind === "speaking";
  const [phase, setPhase] = useState<Phase>({ step: "input" });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [now] = useState(() => new Date());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const idea = sentenceIdea(card.id, card.schedule.reps);
  const meaning = translationText(card.content);
  const intervals = useMemo(() => ratingIntervals(card, now), [card, now]);
  const text = responseText.trim();
  const feedback = phase.step === "feedback" ? phase.result : null;

  useEffect(() => {
    prefetchEnglish(card.lemma);
  }, [card.lemma]);

  // Focus the field on devices with a real keyboard.
  useEffect(() => {
    if (!isSpeaking && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [isSpeaking]);

  // Keep "Далі" on screen after the feedback arrives (phones).
  useEffect(() => {
    if (feedback) actionsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [feedback]);

  // Recording timer and the hard stop at the limit.
  useEffect(() => {
    if (phase.step !== "recording") return;
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - phase.startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS) recorderRef.current?.stop();
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Leaving the card mid-recording releases the microphone.
  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  // Keyboard after the feedback: Enter goes on, 1–4 rate, Z undoes.
  useEffect(() => {
    if (!feedback) return;
    function handleKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || !feedback) return;
      const byKey: Record<string, ReviewRating | undefined> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      const rating = byKey[event.key];
      if (rating) {
        event.preventDefault();
        finish(rating);
      } else if (event.key === "Enter") {
        event.preventDefault();
        finish(feedback.rating);
      } else if ((event.key === "z" || event.key === "я") && canUndo) {
        undo();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function finish(rating: ReviewRating) {
    grade(rating, feedback?.transcript ?? text);
  }

  function handleResult(result: ProductionCheck) {
    if (result.status === "ok") {
      reveal();
      setPhase({ step: "feedback", result });
      return;
    }
    setPhase({ step: "input" });
    if (result.status === "silent") setProblem({ type: "silent" });
    else {
      setProblem({
        type: "blocked",
        message: result.message,
        kinds: result.reason === "budget" ? ["sentence", "speaking"] : [card.kind],
      });
    }
  }

  async function checkSentence() {
    if (!text || phase.step === "checking") return;
    setProblem(null);
    setPhase({ step: "checking" });
    try {
      const result = await checkSentenceAction({ cardId: card.id, text });
      if (!result.ok) throw new Error(result.error);
      handleResult(result.data);
    } catch (error) {
      setPhase({ step: "input" });
      setProblem({ type: "error", message: formatError(error) });
    }
  }

  async function startRecording() {
    setProblem(null);
    // Pin the card: a queue refresh must not swap it mid-recording.
    setResponseText("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      setProblem(micProblem(error));
      return;
    }
    if (cancelledRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    const mimeType = recorderTypes.find((type) => MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      setProblem(micProblem(error));
      return;
    }
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      if (cancelledRef.current) return;
      const seconds = Math.min((Date.now() - startedAt) / 1000, MAX_RECORDING_SECONDS);
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      void sendRecording(blob, seconds);
    };
    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    setPhase({ step: "recording", startedAt });
  }

  async function sendRecording(blob: Blob, seconds: number) {
    if (seconds < 0.8 || blob.size < 500) {
      setPhase({ step: "input" });
      setProblem({ type: "silent" });
      return;
    }
    setPhase({ step: "checking" });
    try {
      const form = new FormData();
      form.append("cardId", card.id);
      form.append("seconds", seconds.toFixed(1));
      form.append("audio", blob, "speech");
      const result = await checkSpeechAction(form);
      if (!result.ok) throw new Error(result.error);
      handleResult(result.data);
    } catch (error) {
      setPhase({ step: "input" });
      setProblem({ type: "error", message: formatError(error) });
    }
  }

  const checking = phase.step === "checking";

  return (
    <article className={cardShellClass} data-testid="production-card">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />
      <CardTopBar card={card} kindLabel={cardKindLabels[card.kind]} onPause={() => pause(card.id)} />

      <div className="flex flex-1 flex-col justify-center px-5 pb-4 pt-2 text-center md:px-10 md:pb-6">
        <p className="text-sm text-muted">
          {isSpeaking ? "Скажи вголос речення з цим словом" : "Напиши своє речення з цим словом"}
        </p>
        <div className="mt-1.5 flex items-center justify-center gap-1">
          <h2 className="text-2xl font-semibold tracking-tight md:text-[32px] md:leading-tight" lang="en">
            {card.lemma}
          </h2>
          <SpeakButton text={card.lemma} />
        </div>
        <p className="text-sm text-muted">
          {meaning}
          {card.content.part_of_speech ? <span className="text-faint"> · {card.content.part_of_speech}</span> : null}
        </p>
        {feedback ? null : (
          <p className="mt-2 text-[13px] text-faint">
            Ідея: {idea} — або будь-що своє
          </p>
        )}
      </div>

      <div className="border-t border-line/70 bg-surface-1/40 p-4 md:p-5">
        {feedback ? (
          <FeedbackView isSpeaking={isSpeaking} lemma={card.lemma} result={feedback} text={text} />
        ) : isSpeaking ? (
          <Recorder
            checking={checking}
            elapsed={elapsed}
            recording={phase.step === "recording"}
            onStart={() => void startRecording()}
            onStop={() => recorderRef.current?.stop()}
          />
        ) : (
          <>
            <label className="sr-only" htmlFor="production-answer">
              Твоє речення англійською
            </label>
            <textarea
              ref={inputRef}
              autoCapitalize="sentences"
              autoComplete="off"
              autoCorrect="off"
              className="block max-h-40 min-h-[76px] w-full resize-none rounded-2xl border border-line-strong bg-surface-1 px-4 py-3 text-base leading-6 text-text outline-none transition [field-sizing:content] placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60"
              disabled={checking}
              enterKeyHint="send"
              id="production-answer"
              lang="en"
              maxLength={MAX_SENTENCE_LENGTH}
              placeholder="Речення англійською"
              rows={2}
              spellCheck={false}
              value={responseText}
              onChange={(event) => setResponseText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void checkSentence();
                }
              }}
            />
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" disabled={!text || checking} size="lg" variant="primary" onClick={() => void checkSentence()}>
                {checking ? <Loader2 className="size-4 animate-spin" /> : null}
                {checking ? "Перевіряю…" : "Перевірити"}
                {checking ? null : <Kbd>Enter</Kbd>}
              </Button>
              <Button disabled={checking} icon={SkipForward} size="lg" title="Пропустити вправу" onClick={() => skip(card.id)}>
                <span className="sr-only sm:not-sr-only">Пропустити</span>
              </Button>
            </div>
          </>
        )}

        {problem ? (
          <ProblemNote
            problem={problem}
            onRetry={problem.type === "error" && !isSpeaking ? () => void checkSentence() : undefined}
            onSkip={() => {
              if (problem.type === "blocked") skipKinds(problem.kinds);
              else if (problem.type === "mic") skipKinds(["speaking"]);
              else skip(card.id);
            }}
          />
        ) : null}

        {feedback ? (
          <div ref={actionsRef} className="mt-4 scroll-mb-24">
            <AutoRating
              intervals={intervals}
              rating={feedback.rating}
              showOverride={showOverride}
              onGrade={finish}
              onToggleOverride={() => setShowOverride((value) => !value)}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Recorder({
  checking,
  elapsed,
  recording,
  onStart,
  onStop,
}: {
  checking: boolean;
  elapsed: number;
  recording: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  if (checking) {
    return (
      <div className="flex h-14 items-center justify-center gap-2 text-sm text-text-2" role="status">
        <Loader2 className="size-4 animate-spin" />
        Слухаю й перевіряю…
      </div>
    );
  }
  if (recording) {
    const left = Math.max(0, Math.ceil(MAX_RECORDING_SECONDS - elapsed));
    return (
      <div>
        <Button className="w-full" size="lg" variant="danger" onClick={onStop}>
          <Square className="size-4 fill-current" />
          Готово
          <span className="font-mono text-xs opacity-80">0:{String(left).padStart(2, "0")}</span>
        </Button>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-4" aria-hidden="true">
          <div
            className="h-full rounded-full bg-danger transition-[width] duration-200"
            style={{ width: `${Math.min(100, (elapsed / MAX_RECORDING_SECONDS) * 100)}%` }}
          />
        </div>
      </div>
    );
  }
  return (
    <Button className="w-full" size="lg" variant="primary" onClick={onStart}>
      <Mic className="size-4" />
      Записати
    </Button>
  );
}

function ProblemNote({
  problem,
  onRetry,
  onSkip,
}: {
  problem: Problem;
  onRetry?: () => void;
  onSkip: () => void;
}) {
  const message = problem.type === "silent" ? "Нічого не розчув. Говори ближче до телефона й трохи голосніше." : problem.message;
  const Icon = problem.type === "mic" ? MicOff : AlertTriangle;
  const skipLabel = problem.type === "blocked" || problem.type === "mic" ? "Далі без цієї вправи" : "Пропустити";
  return (
    <div className="mt-3 rounded-2xl border border-amber/30 bg-amber-soft/60 p-3" role="alert">
      <p className="flex items-start gap-2 text-sm leading-5 text-text">
        <Icon className="mt-0.5 size-4 shrink-0 text-amber" />
        {message}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {onRetry ? (
          <Button icon={RotateCcw} size="sm" onClick={onRetry}>
            Ще раз
          </Button>
        ) : null}
        <Button icon={SkipForward} size="sm" variant="ghost" onClick={onSkip}>
          {skipLabel}
        </Button>
      </div>
    </div>
  );
}

function FeedbackView({
  isSpeaking,
  lemma,
  result,
  text,
}: {
  isSpeaking: boolean;
  lemma: string;
  result: Extract<ProductionCheck, { status: "ok" }>;
  text: string;
}) {
  const { feedback } = result;
  const verdict = verdictMeta[feedback.verdict];
  const said = result.transcript ?? text;
  const sameAsNatural = feedback.natural.toLowerCase().replace(/[^a-z]/g, "") === said.toLowerCase().replace(/[^a-z]/g, "");

  return (
    <div className="animate-reveal space-y-2.5" data-testid="production-feedback">
      <div className="rounded-2xl border border-line bg-surface-2/70 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs text-faint">{isSpeaking ? "Розпізнано" : "Твоє речення"}</span>
          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${verdict.className}`}>
            {feedback.verdict === "good" ? <Check className="size-3.5" /> : null}
            {verdict.label}
          </span>
        </div>
        <p className="mt-1 break-words text-[15px] leading-6 text-text" lang="en" data-testid="production-said">
          {said}
        </p>
        {isSpeaking ? (
          <p className={`mt-1 flex items-center gap-1 text-xs ${result.heard ? "text-accent" : "text-amber"}`}>
            {result.heard ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {result.heard
              ? `Слово «${lemma}» розпізнано`
              : `Слово «${lemma}» не розпізнано — можливо, через вимову. Послухай, як воно звучить.`}
          </p>
        ) : null}
        {feedback.mistakes.length > 0 ? (
          <ul className="mt-2 space-y-1 border-t border-line/70 pt-2">
            {feedback.mistakes.map((mistake, index) => (
              <li key={index} className="text-sm leading-5">
                <span className="text-danger line-through decoration-danger/60" lang="en">
                  {mistake.wrong}
                </span>{" "}
                → <span className="font-semibold text-accent-strong" lang="en">{mistake.right}</span>
                {mistake.why ? <span className="text-muted"> — {mistake.why}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {feedback.natural && !sameAsNatural ? (
        <div className="rounded-2xl border border-accent/25 bg-accent-soft/40 px-4 py-2.5">
          <p className="text-xs text-faint">Як сказав би носій</p>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[15px] font-medium leading-6 text-text" lang="en">
              {feedback.natural}
            </p>
            <SpeakButton className="-my-1 -mr-2" label="Прослухати" text={feedback.natural} />
          </div>
        </div>
      ) : null}

      {feedback.comment ? <p className="px-1 text-sm leading-5 text-text-2">{feedback.comment}</p> : null}
    </div>
  );
}
