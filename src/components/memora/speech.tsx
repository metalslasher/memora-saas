"use client";

import { Volume2 } from "lucide-react";
import { useSyncExternalStore } from "react";

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

export function speakEnglish(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const clean = text.trim();
  if (!clean) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  const voice = pickEnglishVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function SpeakButton({
  className = "",
  label = "Прослухати вимову",
  text,
}: {
  className?: string;
  label?: string;
  text: string;
}) {
  const isSupported = useSpeechSupported();
  if (!isSupported || !text.trim()) return null;

  return (
    <button
      aria-label={label}
      className={`inline-grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-accent ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        speakEnglish(text);
      }}
      title={label}
      type="button"
    >
      <Volume2 className="size-[18px]" />
    </button>
  );
}
