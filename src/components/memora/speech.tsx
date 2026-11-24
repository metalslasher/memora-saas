"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { speechUrlAction } from "@/lib/memora/actions/ai";

function subscribe() {
  return () => undefined;
}

export function useSpeechSupported() {
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
}

function pickEnglishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang === "en-US" && /natural|google|samantha/i.test(voice.name)) ??
    voices.find((voice) => voice.lang === "en-US") ??
    voices.find((voice) => voice.lang.startsWith("en")) ??
    null
  );
}

/** Speaks English text with the best en-US voice on the device (Web Speech API). */
export function speakEnglish(text: string, { rate = 0.92 }: { rate?: number } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const clean = text.trim();
  if (!clean) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "en-US";
  utterance.rate = rate;
  const voice = pickEnglishVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

/* Natural voice: a clip generated once on the server and cached in storage. */
const clips = new Map<string, Promise<HTMLAudioElement | null>>();
let cloudOff = false;
let playing: HTMLAudioElement | null = null;

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

/** The clip for this text, loaded and ready to play (shared by prefetch and play). */
function clip(text: string) {
  if (cloudOff) return Promise.resolve(null);
  let pending = clips.get(text);
  if (!pending) {
    pending = speechUrlAction(text)
      .then((result) => (result.ok ? result.data : null))
      .catch(() => null)
      .then((url) => {
        // No clip (no key, budget or limit reached): device voice for the rest of the visit.
        if (!url) {
          cloudOff = true;
          clips.delete(text);
          return null;
        }
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.load();
        return audio;
      });
    clips.set(text, pending);
  }
  return pending;
}

/** Prepares the clip in the background so a later tap plays at once. */
export function prefetchEnglish(text: string) {
  const clean = normalize(text);
  if (clean && typeof window !== "undefined") void clip(clean);
}

/**
 * Plays English text in the natural voice when available, otherwise with the
 * device voice. `rate` < 0.9 means "slower" (listening exercise).
 */
export async function playEnglish(text: string, { rate = 0.92, cloud = true }: { rate?: number; cloud?: boolean } = {}) {
  const clean = normalize(text);
  if (!clean || typeof window === "undefined") return;
  playing?.pause();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  const audio = cloud ? await clip(clean) : null;
  if (audio) {
    audio.currentTime = 0;
    audio.playbackRate = rate < 0.9 ? 0.9 : 1;
    try {
      playing = audio;
      await audio.play();
      return;
    } catch {
      playing = null;
    }
  }
  speakEnglish(clean, { rate });
}

export function SpeakButton({
  className = "",
  cloud = true,
  label = "Прослухати вимову",
  text,
}: {
  className?: string;
  /** false for guests (landing): only the device voice. */
  cloud?: boolean;
  label?: string;
  text: string;
}) {
  const isSupported = useSpeechSupported();
  // Short texts (a word or phrase) are prepared up front; longer examples load on tap.
  useEffect(() => {
    if (cloud && text.length <= 60) prefetchEnglish(text);
  }, [cloud, text]);
  if ((!isSupported && !cloud) || !text.trim()) return null;

  return (
    <button
      aria-label={label}
      className={`inline-grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-accent ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        void playEnglish(text, { cloud });
      }}
      title={label}
      type="button"
    >
      <Volume2 className="size-[18px]" />
    </button>
  );
}
