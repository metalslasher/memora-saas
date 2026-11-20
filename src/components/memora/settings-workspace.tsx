"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import { CircleHelp, Download, GraduationCap, KeyRound, LogOut, ShieldCheck, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteAllWordsAction,
  exportBackupAction,
  exportWordsCsvAction,
  resetProgressAction,
  restoreBackupAction,
  updateDailyMinutesAction,
} from "@/lib/memora/actions/account";
import { unwrap } from "@/lib/memora/actions/result";
import { parseBackupJson, previewBackup, type BackupDocument, type BackupPreview } from "@/lib/memora/backup";
import { validatePassword } from "@/lib/memora/password-policy";
import { DAILY_MINUTES_OPTIONS, newWordsPerDay } from "@/lib/memora/pace";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useShell } from "./app-shell";
import {
  Button,
  buttonClass,
  FieldLabel,
  PageHeader,
  PasswordInput,
  SectionHeader,
  SegmentedControl,
  ShellPanel,
  StatusBanner,
} from "./shared-ui";
import { useFreshSnapshot } from "./use-fresh-snapshot";
import { dateStamp, downloadTextFile, formatDate, formatError, plural } from "./utils";
import { hardNavigate } from "./hard-navigate";

export function SettingsWorkspace({
  counts,
  email,
  dailyMinutes,
  isRecovery,
  snapshot,
}: {
  counts: { words: number; reviews: number };
  email: string | null;
  dailyMinutes: number;
  isRecovery: boolean;
  snapshot: string;
}) {
  useFreshSnapshot(snapshot);
  const { showError } = useShell();

  async function signOut() {
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      hardNavigate("/");
    } catch (error) {
      showError(error);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Профіль"
        description={email ?? undefined}
        action={
          <>
            <Link className={buttonClass("secondary", "sm", "lg:hidden")} href="/app/help">
              <CircleHelp className="size-4" />
              Довідка
            </Link>
            <Button className="lg:hidden" icon={LogOut} size="sm" onClick={() => void signOut()}>
              Вийти
            </Button>
          </>
        }
      />

      {isRecovery ? (
        <StatusBanner tone="success" message="Ти перейшов за посиланням для відновлення. Задай новий пароль нижче." />
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <LearningPanel dailyMinutes={dailyMinutes} />
        <PasswordPanel />
      </div>

      <DataPanel counts={counts} />
    </div>
  );
}

function LearningPanel({ dailyMinutes }: { dailyMinutes: number }) {
  const { showToast } = useShell();
  const [minutes, setMinutes] = useState(dailyMinutes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(value: number) {
    if (value === minutes || isSaving) return;
    const previous = minutes;
    setMinutes(value);
    setIsSaving(true);
    setError(null);
    try {
      setMinutes(unwrap(await updateDailyMinutesAction(value)));
      showToast("success", "Збережено.");
    } catch (saveError) {
      setMinutes(previous);
      setError(formatError(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader icon={GraduationCap} title="Навчання" description="Скільки часу на день готовий приділяти." />

      <div className="mt-5">
        <FieldLabel>Хвилин на день</FieldLabel>
        <SegmentedControl
          ariaLabel="Хвилин на день"
          className="mt-2 w-full sm:w-auto"
          options={DAILY_MINUTES_OPTIONS.map((value) => ({ value: String(value), label: String(value) }))}
          value={String(minutes)}
          onChange={(value) => void choose(Number(value))}
        />
        <p className="mt-2 text-xs leading-5 text-faint">
          Це приблизно {plural(newWordsPerDay(minutes, 0), ["нове слово", "нові слова", "нових слів"])} на день,
          коли повторень небагато. Якщо
          повторень назбиралося, нових буде менше — Memora рахує це сама.
        </p>
      </div>

      {error ? <StatusBanner className="mt-4" tone="error" message={error} /> : null}
    </ShellPanel>
  );
}

function PasswordPanel() {
  const { showToast } = useShell();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const passwordError = validatePassword(newPassword);
    if (passwordError) return setError(passwordError);
    if (newPassword !== confirmPassword) return setError("Паролі не збігаються.");

    setIsSaving(true);
    try {
      const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      showToast("success", "Пароль оновлено.");
    } catch (updateError) {
      setError(formatError(updateError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader icon={ShieldCheck} title="Пароль" description="Від 8 символів, з літерою і цифрою." />
      <form className="mt-6 space-y-4" onSubmit={updatePassword}>
        <PasswordInput autoComplete="new-password" label="Новий пароль" value={newPassword} onChange={setNewPassword} />
        <PasswordInput autoComplete="new-password" label="Ще раз" value={confirmPassword} onChange={setConfirmPassword} />
        {error ? <StatusBanner tone="error" message={error} /> : null}
        <Button
          className="w-full sm:w-auto"
          disabled={isSaving || !newPassword || !confirmPassword}
          icon={KeyRound}
          isLoading={isSaving}
          type="submit"
        >
          Оновити пароль
        </Button>
      </form>
    </ShellPanel>
  );
}

function DataPanel({ counts }: { counts: { words: number; reviews: number } }) {
  const router = useRouter();
  const { showError, showToast } = useShell();
  const [isBusy, setIsBusy] = useState(false);
  const [backup, setBackup] = useState<{ document: BackupDocument; preview: BackupPreview } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoreConfirmed, setIsRestoreConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function run(task: () => Promise<void>) {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await task();
    } catch (error) {
      showError(error);
    } finally {
      setIsBusy(false);
    }
  }

  const exports = [
    {
      label: "Повна копія",
      hint: "JSON — для відновлення",
      onClick: () =>
        run(async () => {
          const document = unwrap(await exportBackupAction());
          downloadTextFile(
            `memora-backup-${dateStamp()}.json`,
            JSON.stringify(document, null, 2),
            "application/json;charset=utf-8",
          );
        }),
    },
    {
      label: "Слова",
      hint: "CSV-таблиця",
      onClick: () =>
        run(async () => {
          downloadTextFile(`memora-words-${dateStamp()}.csv`, unwrap(await exportWordsCsvAction()), "text/csv;charset=utf-8");
        }),
    },
  ];

  async function handleBackupFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setRestoreError(null);
    setBackup(null);
    setIsRestoreConfirmed(false);
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return setRestoreError("Файл завеликий — максимум 4 МБ.");

    try {
      const document = parseBackupJson(await file.text());
      setBackup({ document, preview: previewBackup(document) });
    } catch (error) {
      setRestoreError(formatError(error));
    }
  }

  function restore() {
    if (!backup || !isRestoreConfirmed) return;
    return run(async () => {
      const restored = unwrap(await restoreBackupAction(backup.document));
      setBackup(null);
      setIsRestoreConfirmed(false);
      showToast("success", `Резервну копію відновлено: ${restored} слів.`);
      router.refresh();
    });
  }

  function confirmReset() {
    if (!window.confirm(`Обнулити історію повторень (${counts.reviews})? Слова залишаться, але всі картки почнуть навчання з нуля.`)) return;
    return run(async () => {
      unwrap(await resetProgressAction());
      showToast("success", "Прогрес обнулено.");
      router.refresh();
    });
  }

  function confirmDeleteAll() {
    if (!window.confirm(`Видалити всі слова (${counts.words}) разом із картками та історією? Скасувати це не можна.`)) return;
    return run(async () => {
      unwrap(await deleteAllWordsAction());
      showToast("success", "Усі слова видалено.");
      router.refresh();
    });
  }

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader icon={Download} title="Дані" description="Збережи копію своїх слів або віднови їх із файлу." />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {exports.map((item) => (
          <button
            key={item.label}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-1 p-4 text-left transition hover:border-accent/50 disabled:opacity-60"
            disabled={isBusy}
            onClick={() => void item.onClick()}
            type="button"
          >
            <span>
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{item.hint}</span>
            </span>
            <Download className="size-4 text-muted transition group-hover:text-accent" />
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Відновити з копії</p>
          <p className="mt-0.5 text-xs text-muted">Поточні слова й історію буде замінено даними з файлу.</p>
        </div>
        <input
          ref={fileInputRef}
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void handleBackupFile(event)}
          type="file"
        />
        <Button disabled={isBusy} icon={Upload} size="sm" onClick={() => fileInputRef.current?.click()}>
          Обрати файл
        </Button>
      </div>

      {restoreError ? <StatusBanner className="mt-3" tone="error" message={restoreError} /> : null}

      {backup ? (
        <div className="animate-rise mt-3 rounded-2xl border border-line-strong bg-surface-1 p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <PreviewMetric label="Дата копії" value={formatDate(backup.preview.exportedAt)} />
            <PreviewMetric label="Слова" value={backup.preview.words} />
            <PreviewMetric label="Картки" value={backup.preview.cards} />
            <PreviewMetric label="Повторення" value={backup.preview.reviews} />
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-text-2">
            <input
              checked={isRestoreConfirmed}
              className="mt-1 size-4 accent-[var(--accent)]"
              onChange={(event) => setIsRestoreConfirmed(event.target.checked)}
              type="checkbox"
            />
            Розумію, що поточні слова, картки й історію буде замінено.
          </label>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={isBusy}
              size="sm"
              onClick={() => {
                setBackup(null);
                setIsRestoreConfirmed(false);
              }}
            >
              Скасувати
            </Button>
            <Button
              disabled={!isRestoreConfirmed || isBusy}
              icon={Upload}
              isLoading={isBusy}
              size="sm"
              variant="primary"
              onClick={() => void restore()}
            >
              Відновити
            </Button>
          </div>
        </div>
      ) : null}

      <details className="group mt-6 rounded-2xl border border-danger/20 bg-danger-soft/40">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-[#ffb4aa] [&::-webkit-details-marker]:hidden">
          <Trash2 className="size-4" />
          Небезпечна зона
        </summary>
        <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
          <Button
            className="justify-between"
            disabled={isBusy || counts.reviews === 0}
            size="sm"
            variant="danger"
            onClick={() => void confirmReset()}
          >
            Обнулити прогрес
            <span className="font-mono text-xs opacity-80">{counts.reviews}</span>
          </Button>
          <Button
            className="justify-between"
            disabled={isBusy || counts.words === 0}
            size="sm"
            variant="danger"
            onClick={() => void confirmDeleteAll()}
          >
            Видалити всі слова
            <span className="font-mono text-xs opacity-80">{counts.words}</span>
          </Button>
        </div>
      </details>
    </ShellPanel>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}
