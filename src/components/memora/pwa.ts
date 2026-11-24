"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * PWA glue: registers the service worker and keeps Chrome's install prompt
 * (beforeinstallprompt) so the app can offer "Install" in its own UI.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

// Listen as soon as the module loads: Chrome may fire the event before hydration.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    // Not fatal: the app works the same without it, only install is unavailable.
  });
}

export type InstallState = "available" | "installed" | "unavailable";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function snapshot(): InstallState {
  if (installed || isStandalone()) return "installed";
  return deferredPrompt ? "available" : "unavailable";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "available": the browser lets us show its install dialog right now. */
export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, snapshot, () => "unavailable" as InstallState);
  const install = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return "unavailable" as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // The same event cannot be prompted twice.
    deferredPrompt = null;
    emit();
    return outcome;
  }, []);
  return { state, install };
}
