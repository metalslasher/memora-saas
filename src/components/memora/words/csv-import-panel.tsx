"use client";

import { Check, Download, FileUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { unwrap } from "@/lib/memora/actions/result";
import { importWordsAction } from "@/lib/memora/actions/words";
import { csvTemplate, parseWordsCsv, type CsvImportPreview } from "@/lib/memora/csv-import";
import { lemmaKey } from "@/lib/memora/duplicates";
import type { WordListItem } from "@/lib/memora/types";
import { useShell } from "../app-shell";
import { Button, MiniStat, StatusBanner } from "../shared-ui";
import { downloadTextFile } from "../utils";

export function CsvImportPanel({
  words,
  onImported,
}: {
  words: WordListItem[];
  onImported: (words: WordListItem[]) => void;
}) {
  const { showError } = useShell();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const existing = useMemo(() => new Set(words.map((word) => lemmaKey(word.lemma))), [words]);

  const readyRows = preview?.rows.filter((row) => row.status === "ready" && row.draft) ?? [];
  const issues = preview?.rows.filter((row) => row.status !== "ready").slice(0, 5) ?? [];

  async function readFile(file: File) {
    setMessage(null);
    setFileName(file.name);
    if (file.size > 1024 * 1024) {
      setPreview(null);
      setMessage({ tone: "error", text: "Файл завеликий — до 1 МБ за раз." });
      return;
    }
    setPreview(parseWordsCsv(await file.text(), existing));
  }

  async function submitImport() {
    if (readyRows.length === 0 || isImporting) return;
    setIsImporting(true);
    setMessage(null);
    try {
      const result = unwrap(await importWordsAction(readyRows.map((row) => row.draft!)));
      onImported(result.imported);
      setPreview(null);
      setFileName(null);
      const skipped = (preview?.summary.duplicates ?? 0) + result.skippedDuplicates;
      const invalid = (preview?.summary.invalid ?? 0) + result.invalidRows;
      setMessage({
        tone: "success",
        text: `Додано ${result.imported.length}${skipped ? `, пропущено повторів: ${skipped}` : ""}${
          invalid ? `, з помилками: ${invalid}` : ""
        }.`,
      });
    } catch (error) {
      showError(error);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <input
        ref={fileInputRef}
        accept=".csv,text/csv,text/plain"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void readFile(file);
        }}
      />

      <button
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          isDragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent/50"
        }`}
        disabled={isImporting}
        onClick={() => fileInputRef.current?.click()}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void readFile(file);
        }}
        type="button"
      >
        <FileUp className="size-6 text-accent" />
        <span className="text-sm font-semibold">{fileName ?? "Обери CSV-файл або перетягни сюди"}</span>
        <span className="text-xs text-muted">Колонки: слово, переклад, частина мови, приклад</span>
      </button>

      <button
        className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-strong"
        onClick={() => downloadTextFile("memora-words-template.csv", csvTemplate(), "text/csv;charset=utf-8")}
        type="button"
      >
        <Download className="size-4" />
        Завантажити шаблон
      </button>

      {preview ? (
        <div className="animate-rise space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="готові" value={preview.summary.ready.toString()} />
            <MiniStat label="повтори" value={preview.summary.duplicates.toString()} />
            <MiniStat label="з помилками" value={preview.summary.invalid.toString()} />
          </div>

          {issues.length > 0 ? (
            <ul className="space-y-1.5 text-xs leading-5 text-muted">
              {issues.map((row) => (
                <li key={row.rowNumber} className="rounded-lg bg-surface-1 px-3 py-2">
                  <span className="font-medium text-text-2">Рядок {row.rowNumber}: </span>
                  {row.errors.length > 0 ? row.errors.join(" ") : `«${row.draft?.lemma}» ${row.duplicateOf}`}
                </li>
              ))}
            </ul>
          ) : null}

          <Button
            className="w-full"
            disabled={readyRows.length === 0 || isImporting}
            icon={Check}
            isLoading={isImporting}
            size="lg"
            variant="primary"
            onClick={() => void submitImport()}
          >
            Додати {readyRows.length}
          </Button>
        </div>
      ) : null}

      {message ? <StatusBanner tone={message.tone} message={message.text} /> : null}
    </div>
  );
}
