"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import { ShellPanel, StatusBanner, TextInput } from "./shared-ui";
import { formatError } from "./utils";

export function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070a0f] px-4 text-[#eef4ff]">
      <div
        className="relative grid size-24 place-items-center md:size-28"
        role="status"
        aria-label="Завантаження Memora"
      >
        <div className="absolute inset-0 rounded-full border border-[#2dd4bf]/20" />
        <div className="absolute inset-0 animate-[spin_1.7s_linear_infinite] rounded-full border-2 border-transparent border-t-[#2dd4bf] border-r-[#2dd4bf]/30" />
        <div className="absolute inset-3 animate-pulse rounded-full border border-[#52e0c4]/15" />
        <div className="absolute inset-0 animate-[spin_4.5s_linear_infinite]">
          <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-[#52e0c4] shadow-[0_0_22px_rgba(45,212,191,0.9)]" />
          <span className="absolute bottom-2 left-3 size-1.5 rounded-full bg-[#7c6df2] shadow-[0_0_18px_rgba(124,109,242,0.75)]" />
          <span className="absolute right-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-[#ffb45f] shadow-[0_0_18px_rgba(255,180,95,0.65)]" />
        </div>
        <div className="absolute inset-8 rounded-full bg-[#2dd4bf]/10 blur-xl" />
        <Brain
          className="relative size-8 text-[#eef4ff] drop-shadow-[0_0_18px_rgba(238,244,255,0.42)]"
          strokeWidth={1.8}
        />
        <span className="sr-only">Завантаження</span>
      </div>
    </main>
  );
}

export function AuthPanel({
  errorMessage,
  statusMessage,
  onResetPassword,
  onSignIn,
  onSignUp,
}: {
  errorMessage: string | null;
  statusMessage: string | null;
  onResetPassword: (email: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setLocalError(null);

    try {
      if (mode === "sign-in") {
        await onSignIn(email.trim(), password);
      } else {
        await onSignUp(email.trim(), password);
      }
    } catch (error) {
      setLocalError(formatError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPasswordReset() {
    if (email.trim().length <= 3 || isSubmitting) {
      setLocalError("Вкажи email, на який надіслати лист для відновлення.");
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);

    try {
      await onResetPassword(email.trim());
    } catch (error) {
      setLocalError(formatError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070a0f] px-4 py-6 text-[#eef4ff]">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-5xl place-items-center">
        <ShellPanel className="grid w-full overflow-hidden md:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-h-[360px] flex-col justify-start border-b border-[#263140] bg-[#0d131c] p-6 md:min-h-[420px] md:border-b-0 md:border-r md:p-7">
            <div>
              <div className="flex items-center gap-3">
                <Brain
                  className="size-8 shrink-0 text-[#eef4ff] drop-shadow-[0_0_14px_rgba(238,244,255,0.28)]"
                  strokeWidth={1.8}
                />
                <div>
                  <p className="text-xl font-semibold">Memora</p>
                  <p className="text-sm text-[#9aa8ba]">Простір для навчання</p>
                </div>
              </div>
              <h1 className="mt-9 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">
                Вчи англійські слова й терміни з тестування через регулярне пригадування.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#9aa8ba]">
                Memora підказує, що варто повторити сьогодні, і поступово додає
                нові слова та QA-терміни без перевантаження.
              </p>
            </div>
          </div>

          <form className="p-5 md:p-7" onSubmit={submitAuth}>
            <div className="grid grid-cols-2 rounded-lg border border-[#263140] bg-[#151d28] p-1">
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  mode === "sign-in"
                    ? "bg-[#2dd4bf] text-[#071018]"
                    : "text-[#9aa8ba]"
                }`}
                onClick={() => setMode("sign-in")}
              >
                Увійти
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  mode === "sign-up"
                    ? "bg-[#2dd4bf] text-[#071018]"
                    : "text-[#9aa8ba]"
                }`}
                onClick={() => setMode("sign-up")}
              >
                Реєстрація
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <TextInput
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
                type="email"
              />
              <label className="block">
                <span className="text-sm font-medium text-[#c7d0dd]">Пароль</span>
                <input
                  className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Мінімум 6 символів"
                  type="password"
                />
              </label>
            </div>

            {localError || errorMessage ? (
              <StatusBanner tone="error" message={localError ?? errorMessage ?? ""} />
            ) : null}
            {statusMessage ? (
              <StatusBanner tone="success" message={statusMessage} />
            ) : null}

            <button
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
              disabled={!canSubmit || isSubmitting}
              type="submit"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "sign-in" ? "Увійти" : "Створити акаунт"}
            </button>
            {mode === "sign-in" ? (
              <button
                className="mt-3 w-full rounded-lg border border-[#263140] px-4 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => void submitPasswordReset()}
                type="button"
              >
                Відновити пароль
              </button>
            ) : null}
          </form>
        </ShellPanel>
      </div>
    </main>
  );
}
