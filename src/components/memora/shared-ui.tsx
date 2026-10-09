"use client";

import type * as React from "react";
import { useEffect, useId, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import type { StudyMode } from "@/lib/memora/types";
import type { IconType } from "./types";
import { modeLabels } from "./types";

export function ShellPanel({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface-2/80 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_20px_60px_-30px_rgba(0,0,0,0.6)] ${className}`}
      id={id}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_8px_24px_-12px_rgba(62,224,191,0.7)] disabled:bg-surface-4 disabled:text-faint disabled:shadow-none",
  secondary:
    "border border-line-strong bg-surface-3/60 text-text-2 hover:border-accent/60 hover:text-text disabled:opacity-50",
  ghost: "text-text-2 hover:bg-surface-3 hover:text-text disabled:opacity-50",
  danger:
    "border border-danger/30 bg-danger-soft text-[#ffb4aa] hover:border-danger/70 hover:text-white disabled:opacity-50",
  soft: "bg-accent-soft text-accent hover:bg-accent/20 disabled:opacity-50",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-[15px]",
  icon: "size-10 rounded-xl",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className = "",
) {
  return `inline-flex shrink-0 items-center justify-center font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
}

export function Button({
  children,
  className = "",
  icon: Icon,
  isLoading = false,
  size = "md",
  variant = "secondary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconType;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button className={buttonClass(variant, size, className)} type={type} {...props}>
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : Icon ? (
        <Icon className="size-4" />
      ) : null}
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="hidden min-w-5 items-center justify-center rounded-md border border-current/25 px-1 font-mono text-[11px] leading-5 opacity-70 md:inline-flex">
      {children}
    </kbd>
  );
}

export function StatusBanner({
  tone,
  message,
  className = "",
}: {
  tone: "error" | "success";
  message: string;
  className?: string;
}) {
  const classes =
    tone === "error"
      ? "border-danger/30 bg-danger-soft text-[#ffc0b7]"
      : "border-accent/30 bg-accent-soft text-accent-strong";

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${classes} ${className}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="leading-5">{message}</span>
    </div>
  );
}

export type ToastMessage = {
  id: number;
  tone: "error" | "success" | "info";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(
      onDismiss,
      toast.tone === "error" ? 8000 : toast.onAction ? 6000 : 3500,
    );
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const toneClass = {
    error: "border-danger/40 text-[#ffc0b7]",
    success: "border-accent/30 text-text",
    info: "border-line-strong text-text",
  }[toast.tone];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 lg:bottom-6">
      <div
        key={toast.id}
        className={`animate-rise pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl border bg-surface-3/95 py-2.5 pl-4 pr-2 text-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl ${toneClass}`}
        role={toast.tone === "error" ? "alert" : "status"}
      >
        {toast.tone === "error" ? (
          <AlertCircle className="size-4 shrink-0 text-danger" />
        ) : (
          <Check className="size-4 shrink-0 text-accent" />
        )}
        <span className="leading-5">{toast.message}</span>
        {toast.onAction && toast.actionLabel ? (
          <button
            className="ml-1 shrink-0 rounded-lg px-2.5 py-1.5 font-semibold text-accent transition hover:bg-accent-soft"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            type="button"
          >
            {toast.actionLabel}
          </button>
        ) : null}
        <button
          aria-label="Закрити повідомлення"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-4 hover:text-text"
          onClick={onDismiss}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  className = "",
  options,
  value,
  onChange,
  ariaLabel,
}: {
  className?: string;
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={`inline-grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-surface-1 p-1 ${className}`}
      role="tablist"
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            aria-selected={isActive}
            key={option.value}
            className={`flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition ${
              isActive
                ? "bg-surface-4 text-text shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]"
                : "text-muted hover:text-text"
            }`}
            onClick={() => onChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={`rounded-md px-1.5 font-mono text-[11px] leading-5 ${
                  isActive ? "bg-accent-soft text-accent" : "bg-surface-3 text-muted"
                }`}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ModeSelector({
  className = "",
  counts,
  value,
  onChange,
}: {
  className?: string;
  counts?: Partial<Record<StudyMode, number>>;
  value: StudyMode;
  onChange: (mode: StudyMode) => void;
}) {
  return (
    <SegmentedControl
      ariaLabel="Що повторювати"
      className={className}
      options={(Object.keys(modeLabels) as StudyMode[]).map((mode) => ({
        value: mode,
        label: modeLabels[mode],
        count: counts?.[mode],
      }))}
      value={value}
      onChange={onChange}
    />
  );
}

export function Metric({
  icon: Icon,
  label,
  value,
  accent,
  className = "",
}: {
  icon: IconType;
  label: string;
  value: string;
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface-2/70 p-4 ${className}`}
    >
      <div className={`grid size-8 place-items-center rounded-lg ${accent}`}>
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: IconType;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export const fieldClass =
  "w-full rounded-xl border border-line-strong bg-surface-1 px-3.5 text-[15px] text-text outline-none transition placeholder:text-faint hover:border-[#3a4759] focus:border-accent focus:ring-4 focus:ring-accent/15 md:text-sm";

export function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <span className="flex items-baseline justify-between gap-3 text-sm font-medium text-text-2">
      {children}
      {hint ? <span className="text-xs font-normal text-faint">{hint}</span> : null}
    </span>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  hint,
  inputMode,
  name,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  hint?: React.ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  name?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        className={`mt-1.5 h-11 ${fieldClass}`}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-text-2" htmlFor={id}>
          {label}
        </label>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </div>
      <span className="relative mt-1.5 block">
        <input
          id={id}
          className={`h-11 pr-11 ${fieldClass}`}
          autoComplete={autoComplete}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-label={isVisible ? "Сховати пароль" : "Показати пароль"}
          className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:text-text"
          onClick={(event) => {
            event.preventDefault();
            setIsVisible((current) => !current);
          }}
          type="button"
        >
          {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        className={`mt-1.5 resize-none py-3 leading-6 ${fieldClass}`}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "violet" | "amber" | "red" | "neutral";
}) {
  const classes = {
    green: "bg-accent-soft text-accent",
    violet: "bg-violet-soft text-violet",
    amber: "bg-amber-soft text-amber",
    red: "bg-danger-soft text-danger",
    neutral: "bg-surface-3 text-muted",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium leading-5 ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

export function DeckStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "green" | "violet";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <p className="font-mono text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-text-2">{title}</p>
      <div
        className={`mt-3 h-1 rounded-full ${tone === "green" ? "bg-accent" : "bg-violet"}`}
      />
    </div>
  );
}

export function MiniStat({
  className = "",
  hint,
  label,
  value,
}: {
  className?: string;
  hint?: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface-1 px-3.5 py-3 ${className}`}
      title={hint}
    >
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

export function ReadOnlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: IconType;
  label: string;
  value: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-1/60 px-3.5 text-sm text-text-2">
        <Icon className="size-4 text-accent" />
        <span className="min-w-0 truncate">{value}</span>
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: IconType;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          {Icon ? <Icon className="size-4 text-accent" /> : null}
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}

/** Full-screen sheet on phones, centered dialog on larger screens. */
export function Dialog({
  children,
  label,
  onClose,
  size = "md",
}: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const width = { md: "sm:max-w-md", lg: "sm:max-w-2xl", xl: "sm:max-w-5xl" }[size];

  return (
    <div
      aria-label={label}
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
    >
      <button
        aria-label="Закрити"
        className="animate-fade absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        className={`animate-sheet relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-surface-2 shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:max-h-[88svh] sm:rounded-3xl ${width}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  title,
  subtitle,
  onClose,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      <button
        aria-label="Закрити"
        className="-mr-1 grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-text"
        onClick={onClose}
        type="button"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
