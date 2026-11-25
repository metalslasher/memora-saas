"use client";

import { Pause, Volume2 } from "lucide-react";
import { useRef, useState } from "react";

/** Plays a pre-recorded clip of the same voice the app uses (loaded on tap only). */
export function PlayClip({ src, label, large = false }: { src: string; label: string; large?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function toggle() {
    if (!audio.current) {
      audio.current = new Audio(src);
      audio.current.addEventListener("ended", () => setIsPlaying(false));
      audio.current.addEventListener("pause", () => setIsPlaying(false));
      audio.current.addEventListener("play", () => setIsPlaying(true));
    }
    if (isPlaying) {
      audio.current.pause();
      return;
    }
    audio.current.currentTime = 0;
    void audio.current.play().catch(() => setIsPlaying(false));
  }

  const Icon = isPlaying ? Pause : Volume2;
  return (
    <button
      aria-label={label}
      className={
        large
          ? "inline-grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition hover:bg-accent-strong active:scale-95"
          : "inline-grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-accent"
      }
      onClick={toggle}
      title={label}
      type="button"
    >
      <Icon className={large ? "size-5" : "size-[18px]"} />
    </button>
  );
}
