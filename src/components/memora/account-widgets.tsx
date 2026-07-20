"use client";

import { Download } from "lucide-react";

export function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#101923] p-3">
      <p className="text-xs text-[#9aa8ba]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#eef4ff]">{value}</p>
    </div>
  );
}

export function ExportButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-lg border border-[#263140] bg-[#0d131c] p-4 text-left transition hover:border-[#2dd4bf] hover:bg-[#101a25]"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[#eef4ff]">{label}</span>
        <Download className="size-4 text-[#2dd4bf]" />
      </div>
    </button>
  );
}
