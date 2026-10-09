import {
  BarChart3,
  Code2,
  FileText,
  Languages,
  Target,
  UserCircle,
} from "lucide-react";
import type { CsvImportDraft } from "@/lib/memora/csv-import";
import type { StudyMode } from "@/lib/memora/types";

export type AppView = "today" | "english" | "qa" | "analytics" | "account" | "help";

export type ItemStatus = "active" | "suspended" | "archived";

export type IconType = typeof Target;

export type ImportResultSummary = {
  importedCount: number;
  skippedDuplicates: number;
  invalidRows: number;
};

export type ClientImportCommitRow = {
  rowNumber: number;
  draft?: CsvImportDraft;
  errors?: string[];
  raw?: Record<string, string>;
};

export const levelOptions = [
  { value: "", label: "Не обрано" },
  { value: "beginner", label: "Початковий" },
  { value: "intermediate", label: "Середній" },
  { value: "advanced", label: "Впевнений" },
];

export const modeLabels: Record<StudyMode, string> = {
  daily: "Усе",
  "english-productive": "Англійська",
  "qa-interview": "QA",
};

export const navigationItems: Array<{
  view: AppView;
  label: string;
  shortLabel: string;
  icon: IconType;
}> = [
  { view: "today", label: "Практика", shortLabel: "Практика", icon: Target },
  { view: "english", label: "Англійські слова", shortLabel: "Слова", icon: Languages },
  { view: "qa", label: "QA-терміни", shortLabel: "QA", icon: Code2 },
  { view: "analytics", label: "Прогрес", shortLabel: "Прогрес", icon: BarChart3 },
  { view: "account", label: "Профіль", shortLabel: "Профіль", icon: UserCircle },
  { view: "help", label: "Довідка", shortLabel: "Довідка", icon: FileText },
];
