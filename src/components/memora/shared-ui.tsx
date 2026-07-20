"use client";

import type * as React from "react";
import { AlertCircle, Check } from "lucide-react";
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
      className={`rounded-lg border border-[#263140] bg-[#10161f] shadow-[0_18px_70px_rgba(0,0,0,0.34)] ${className}`}
      id={id}
    >
      {children}
    </div>
  );
}

export function StatusBanner({
  tone,
  message,
}: {
  tone: "error" | "success";
  message: string;
}) {
  const classes =
    tone === "error"
      ? "border-[#6f2b2b] bg-[#2a1215] text-[#ffb4aa]"
      : "border-[#256b60] bg-[#102b27] text-[#8df3dd]";

  return (
    <div className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${classes}`}>
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="leading-5">{message}</span>
    </div>
  );
}

export function ModeSelector({
  className = "",
  value,
  onChange,
}: {
  className?: string;
  value: StudyMode;
  onChange: (mode: StudyMode) => void;
}) {
  return (
    <div
      className={`grid w-full grid-cols-3 gap-1 rounded-lg border border-[#263140] bg-[#151d28] p-1 ${className}`}
    >
      {(Object.keys(modeLabels) as StudyMode[]).map((mode) => (
        <button
          key={mode}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            value === mode
              ? "bg-[#2dd4bf] text-[#071018] shadow-sm"
              : "text-[#c7d0dd] hover:bg-[#1b2432]"
          }`}
          onClick={() => onChange(mode)}
        >
          {modeLabels[mode]}
        </button>
      ))}
    </div>
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
    <div className={`min-h-24 rounded-lg border border-[#263140] bg-[#0d131c] p-3 md:min-h-28 md:p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className={`grid size-8 place-items-center rounded-lg text-white md:size-9 ${accent}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold md:mt-4">{value}</p>
      <p className="mt-1 text-sm text-[#9aa8ba]">{label}</p>
    </div>
  );
}

export function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: IconType;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
        <Icon className="size-7" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#9aa8ba]">{description}</p>
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#c7d0dd]">{label}</span>
      <input
        className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
        autoComplete={autoComplete}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#c7d0dd]">{label}</span>
      <textarea
        className="mt-1 min-h-24 w-full resize-none rounded-lg border border-[#263140] bg-[#0b111a] px-3 py-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
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
  tone: "green" | "violet" | "neutral";
}) {
  const classes = {
    green: "border-[#256b60] bg-[#14352f] text-[#52e0c4]",
    violet: "border-[#48408c] bg-[#211f44] text-[#b8b0ff]",
    neutral: "border-[#263140] bg-[#151d28] text-[#9aa8ba]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${classes[tone]}`}
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
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <p className="font-mono text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm font-medium">{title}</p>
      <div
        className={`mt-3 h-1.5 rounded-full ${
          tone === "green" ? "bg-[#2dd4bf]" : "bg-[#8b7cf6]"
        }`}
      />
    </div>
  );
}

export function MiniStat({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`min-h-18 rounded-lg border border-[#263140] bg-[#0d131c] p-3 ${className}`}>
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#9aa8ba]">{label}</p>
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
      <span className="text-sm font-medium text-[#c7d0dd]">{label}</span>
      <div className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#9aa8ba]">
        <Icon className="size-4 text-[#52e0c4]" />
        <span className="min-w-0 truncate">{value}</span>
      </div>
    </div>
  );
}
