"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";
import { LogoMark } from "./brand";
import {
  Button,
  Dialog,
  DialogHeader,
  PasswordInput,
  StatusBanner,
  TextInput,
} from "./shared-ui";
import { formatError } from "./utils";

export function LoadingScreen({
  error = null,
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-ink px-6 text-text">
      {error ? (
        <div className="max-w-sm text-center">
          <LogoMark className="mx-auto size-12" />
          <h1 className="mt-5 text-lg font-semibold">Не вдалося завантажити дані</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
          {onRetry ? (
            <Button className="mt-5" icon={RotateCw} variant="primary" onClick={onRetry}>
              Спробувати ще раз
            </Button>
          ) : null}
        </div>
      ) : (
        <div aria-label="Завантаження" className="relative grid place-items-center" role="status">
          <span className="absolute size-20 animate-ping rounded-3xl bg-accent/10 [animation-duration:1.6s]" />
          <LogoMark className="relative size-12 animate-pulse" />
          <span className="sr-only">Завантаження</span>
        </div>
      )}
    </main>
  );
}

type AuthMode = "sign-in" | "sign-up" | "reset";

const copy: Record<AuthMode, { title: string; subtitle: string; submit: string }> = {
  "sign-in": {
    title: "З поверненням",
    subtitle: "Увійди, щоб продовжити практику.",
    submit: "Увійти",
  },
  "sign-up": {
    title: "Створи акаунт",
    subtitle: "Хвилина — і стартові картки вже чекають.",
    submit: "Створити акаунт",
  },
  reset: {
    title: "Відновлення пароля",
    subtitle: "Надішлемо посилання для входу на твою пошту.",
    submit: "Надіслати посилання",
  },
};

export function AuthModal({
  initialMode,
  statusMessage,
  onClose,
  onResetPassword,
  onSignIn,
  onSignUp,
}: {
  initialMode: "sign-in" | "sign-up";
  statusMessage: string | null;
  onClose: () => void;
  onResetPassword: (email: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const text = copy[mode];
  const minPassword = mode === "sign-up" ? 8 : 1;
  const canSubmit =
    /\S+@\S+\.\S+/.test(email.trim()) &&
    (mode === "reset" || password.length >= minPassword);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setLocalError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!canSubmit) {
      setLocalError(
        mode === "sign-up" && password.length > 0 && password.length < 8
          ? "Пароль має містити щонайменше 8 символів."
          : "Перевір email і пароль.",
      );
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);

    try {
      if (mode === "sign-in") await onSignIn(email.trim(), password);
      else if (mode === "sign-up") await onSignUp(email.trim(), password);
      else await onResetPassword(email.trim());
    } catch (error) {
      setLocalError(humanizeAuthError(formatError(error)));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog label={text.title} onClose={onClose}>
      <DialogHeader
        title={
          <span className="flex items-center gap-3">
            {mode === "reset" ? (
              <button
                aria-label="Назад до входу"
                className="-ml-1 grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-text"
                onClick={() => changeMode("sign-in")}
                type="button"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <LogoMark className="size-7" />
            )}
            {text.title}
          </span>
        }
        subtitle={text.subtitle}
        onClose={onClose}
      />

      <form className="overflow-y-auto px-5 pb-6 pt-5" noValidate onSubmit={submit}>
        {mode !== "reset" ? (
          <div className="mb-5 grid grid-cols-2 rounded-xl border border-line bg-surface-1 p-1">
            {(["sign-in", "sign-up"] as const).map((item) => (
              <button
                key={item}
                className={`h-9 rounded-lg text-sm font-medium transition ${
                  mode === item ? "bg-surface-4 text-text" : "text-muted hover:text-text"
                }`}
                onClick={() => changeMode(item)}
                type="button"
              >
                {item === "sign-in" ? "Вхід" : "Реєстрація"}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-4">
          <TextInput
            autoComplete="email"
            autoFocus
            inputMode="email"
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
          />
          {mode !== "reset" ? (
            <PasswordInput
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              hint={
                mode === "sign-in" ? (
                  <button
                    className="font-medium text-accent hover:text-accent-strong"
                    onClick={(event) => {
                      event.preventDefault();
                      changeMode("reset");
                    }}
                    type="button"
                  >
                    Забули пароль?
                  </button>
                ) : null
              }
              label="Пароль"
              value={password}
              onChange={setPassword}
            />
          ) : null}
        </div>

        {localError ? (
          <StatusBanner className="mt-4" message={localError} tone="error" />
        ) : null}
        {statusMessage && !localError ? (
          <StatusBanner className="mt-4" message={statusMessage} tone="success" />
        ) : null}

        <Button
          className="mt-5 w-full"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          size="lg"
          type="submit"
          variant="primary"
        >
          {text.submit}
        </Button>

        {mode === "sign-up" ? (
          <p className="mt-4 text-center text-xs leading-5 text-faint">
            Реєструючись, ти отримуєш особистий простір — матеріали бачиш лише ти.
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/** Supabase returns English errors; show the common ones in Ukrainian. */
export function humanizeAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "Невірний email або пароль.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Підтверди email — посилання вже в пошті.";
  }
  if (normalized.includes("user already registered")) {
    return "Такий акаунт уже існує. Спробуй увійти.";
  }
  if (normalized.includes("password should be at least")) {
    return "Пароль закороткий — потрібно щонайменше 8 символів.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Забагато спроб. Зачекай хвилину й спробуй ще раз.";
  }
  if (normalized.includes("unable to validate email") || normalized.includes("invalid email")) {
    return "Схоже, email введено з помилкою.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Немає з’єднання. Перевір інтернет і спробуй ще раз.";
  }
  return message;
}
