"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import {
  AlertCircle,
  KeyRound,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserCircle,
} from "lucide-react";
import { parseBackupJson, previewBackup, type BackupDocument, type BackupPreview } from "@/lib/memora/backup";
import { createBackupJson, notesToCsv } from "@/lib/memora/export";
import type { AppSettings, MemoraState, UserProfile, UserProfileDraft } from "@/lib/memora/types";
import type { User } from "@supabase/supabase-js";
import { levelOptions } from "./types";
import { ExportButton, PreviewMetric } from "./account-widgets";
import { ReadOnlyField, ShellPanel, StatusBanner, TextArea } from "./shared-ui";
import { dateStamp, downloadTextFile, formatDate, formatError } from "./utils";

export function AccountWorkspace({
  isBusy,
  isPasswordRecovery,
  profile,
  state,
  user,
  onClearMaterials,
  onPasswordReset,
  onPasswordUpdate,
  onProfileSave,
  onRestoreBackup,
  onResetLearningStats,
  onSettingsChange,
}: {
  isBusy: boolean;
  isPasswordRecovery: boolean;
  profile: UserProfile | null;
  state: MemoraState;
  user: User | null;
  onClearMaterials: () => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  onPasswordUpdate: (password: string) => Promise<void>;
  onProfileSave: (draft: UserProfileDraft) => Promise<void>;
  onRestoreBackup: (backup: BackupDocument) => Promise<void>;
  onResetLearningStats: () => Promise<void>;
  onSettingsChange: (settings: AppSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<UserProfileDraft>(() =>
    profileToDraft(profile),
  );
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(
    () => state.settings,
  );
  const [dailyNewLimitInput, setDailyNewLimitInput] = useState(
    () => state.settings.dailyNewLimit.toString(),
  );
  const [resetEmail, setResetEmail] = useState(user?.email ?? profile?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);

    const dailyNewLimit = Number.parseInt(dailyNewLimitInput, 10);
    if (
      !Number.isInteger(dailyNewLimit) ||
      dailyNewLimit < 0 ||
      dailyNewLimit > 50
    ) {
      setProfileError("Кількість нових карток має бути числом від 0 до 50.");
      return;
    }

    try {
      await onProfileSave(draft);
      await onSettingsChange({
        ...settingsDraft,
        dailyNewLimit,
      });
    } catch (error) {
      setProfileError(formatError(error));
    }
  }

  async function sendPasswordReset() {
    setSecurityError(null);

    try {
      await onPasswordReset(resetEmail);
    } catch (error) {
      setSecurityError(formatError(error));
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityError(null);

    if (newPassword !== confirmPassword) {
      setSecurityError("Паролі не збігаються.");
      return;
    }

    try {
      await onPasswordUpdate(newPassword);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setSecurityError(formatError(error));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.8fr)] xl:items-start">
      <ShellPanel className="p-4 md:p-5 xl:min-h-[455px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Профіль</h2>
            </div>
            <UserCircle className="size-5 text-[#2dd4bf]" />
          </div>

          {profileError ? <StatusBanner tone="error" message={profileError} /> : null}

          <form className="mt-4 space-y-4" onSubmit={saveProfile}>
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField
                icon={Mail}
                label="Email"
                value={user?.email ?? profile?.email ?? "Не вказано"}
              />

              <label className="block">
                <span className="text-sm font-medium text-[#c7d0dd]">
                  Рівень англійської
                </span>
                <select
                  className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                  value={draft.level}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      level: event.target.value,
                    }))
                  }
                >
                  {levelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <TextArea
              label="Основна ціль"
              placeholder="Наприклад: впевненіше проходити QA співбесіди англійською."
              value={draft.primaryGoal}
              onChange={(primaryGoal) =>
                setDraft((current) => ({ ...current, primaryGoal }))
              }
            />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-[#c7d0dd]">
                  Нових карток на день
                </span>
                <input
                  className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                  inputMode="numeric"
                  max={50}
                  min={0}
                  type="number"
                  value={dailyNewLimitInput}
                  onChange={(event) => setDailyNewLimitInput(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#c7d0dd]">
                  Оцінювання
                </span>
                <select
                  className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                  value={settingsDraft.reviewButtons}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      reviewButtons: event.target.value as AppSettings["reviewButtons"],
                    }))
                  }
                >
                  <option value="simple">2 кнопки</option>
                  <option value="advanced">4 кнопки</option>
                </select>
              </label>
            </div>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab] sm:w-auto"
              disabled={isBusy}
              type="submit"
            >
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Зберегти зміни
            </button>
          </form>
      </ShellPanel>

      <ShellPanel className="p-4 md:p-5 xl:min-h-[455px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Безпека</h2>
            </div>
            <ShieldCheck className="size-5 text-[#2dd4bf]" />
          </div>

          {isPasswordRecovery ? (
            <div className="mt-4 rounded-lg border border-[#256b60] bg-[#102b27] p-3 text-sm leading-6 text-[#8df3dd]">
              Режим відновлення активний. Введи новий пароль нижче.
            </div>
          ) : null}
          {securityError ? (
            <StatusBanner tone="error" message={securityError} />
          ) : null}

          <div className="mt-4 rounded-lg border border-[#263140] bg-[#0d131c] p-4">
            <p className="text-sm font-semibold">Відновлення пароля</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="h-11 min-w-0 flex-1 rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#263140] px-4 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={isBusy}
                onClick={() => void sendPasswordReset()}
                type="button"
              >
                <Mail className="size-4" />
                Надіслати
              </button>
            </div>
          </div>

          <form className="mt-4 space-y-4" onSubmit={updatePassword}>
            <label className="block">
              <span className="text-sm font-medium text-[#c7d0dd]">
                Новий пароль
              </span>
              <input
                className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                autoComplete="new-password"
                minLength={8}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Мінімум 8 символів"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#c7d0dd]">
                Повтори пароль
              </span>
              <input
                className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                autoComplete="new-password"
                minLength={8}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Ще раз новий пароль"
              />
            </label>
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
              disabled={isBusy || newPassword.length < 8 || confirmPassword.length < 8}
              type="submit"
            >
              <KeyRound className="size-4" />
              Оновити пароль
            </button>
          </form>
      </ShellPanel>

      <BackupPanel
        className="xl:col-span-2"
        isBusy={isBusy}
        materialCount={state.notes.length}
        reviewCount={state.reviewLogs.length}
        state={state}
        onClearMaterials={onClearMaterials}
        onResetLearningStats={onResetLearningStats}
        onRestoreBackup={onRestoreBackup}
      />
    </div>
  );
}

function profileToDraft(profile: UserProfile | null): UserProfileDraft {
  return {
    locale: profile?.locale ?? "uk-UA",
    timezone: profile?.timezone ?? "Europe/Kiev",
    level: profile?.level ?? "",
    dailyMinutes: profile?.goals.dailyMinutes ?? 15,
    primaryGoal: profile?.goals.primaryGoal ?? "",
  };
}

function BackupPanel({
  className = "",
  isBusy,
  materialCount,
  onClearMaterials,
  onResetLearningStats,
  onRestoreBackup,
  reviewCount,
  state,
}: {
  className?: string;
  isBusy: boolean;
  materialCount: number;
  onClearMaterials: () => Promise<void>;
  onResetLearningStats: () => Promise<void>;
  onRestoreBackup: (backup: BackupDocument) => Promise<void>;
  reviewCount: number;
  state: MemoraState;
}) {
  const [backupDocument, setBackupDocument] = useState<BackupDocument | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoreConfirmed, setIsRestoreConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleBackupFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setRestoreError(null);
    setBackupDocument(null);
    setBackupPreview(null);
    setIsRestoreConfirmed(false);

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setRestoreError("Файл резервної копії завеликий. Максимальний розмір: 10 MB.");
      return;
    }

    try {
      const document = parseBackupJson(await file.text());
      setBackupDocument(document);
      setBackupPreview(previewBackup(document));
    } catch (error) {
      setRestoreError(formatError(error));
    }
  }

  async function handleRestoreClick() {
    if (!backupDocument || !isRestoreConfirmed || isBusy) return;

    setRestoreError(null);

    try {
      await onRestoreBackup(backupDocument);
      setBackupDocument(null);
      setBackupPreview(null);
      setIsRestoreConfirmed(false);
    } catch (error) {
      setRestoreError(formatError(error));
    }
  }

  function clearRestorePreview() {
    setBackupDocument(null);
    setBackupPreview(null);
    setRestoreError(null);
    setIsRestoreConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function confirmClearMaterials() {
    const confirmed = window.confirm(
      `Видалити всі матеріали (${materialCount}) разом з картками? Цю дію не можна скасувати.`,
    );
    if (!confirmed) return;

    void onClearMaterials().catch(() => undefined);
  }

  function confirmResetStats() {
    const confirmed = window.confirm(
      `Обнулити статистику та історію повторень (${reviewCount})? Матеріали залишаться, але картки почнуть навчання заново.`,
    );
    if (!confirmed) return;

    void onResetLearningStats().catch(() => undefined);
  }

  return (
    <ShellPanel className={`p-4 md:p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Дані</h2>
        </div>
        <span className="font-mono text-sm text-[#9aa8ba]">
          {state.notes.length}
        </span>
      </div>
      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="grid min-w-0 grid-rows-[auto_1fr] gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <ExportButton
              label="Повна копія JSON"
              onClick={() =>
                downloadTextFile(
                  `memora-backup-${dateStamp()}.json`,
                  createBackupJson(state),
                  "application/json;charset=utf-8",
                )
              }
            />
            <ExportButton
              label="CSV зі словами"
              onClick={() =>
                downloadTextFile(
                  `memora-english-${dateStamp()}.csv`,
                  notesToCsv(state.notes, "english"),
                  "text/csv;charset=utf-8",
                )
              }
            />
            <ExportButton
              label="CSV з QA"
              onClick={() =>
                downloadTextFile(
                  `memora-qa-${dateStamp()}.csv`,
                  notesToCsv(state.notes, "qa"),
                  "text/csv;charset=utf-8",
                )
              }
            />
          </div>

          <div className="flex min-h-20 rounded-lg border border-[#263140] bg-[#0d131c] p-3">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[#eef4ff]">
                Відновлення
              </p>
              <input
                ref={fileInputRef}
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleBackupFileChange(event)}
                type="file"
              />
              <button
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#314055] px-4 text-sm font-semibold text-[#dce7f5] transition hover:border-[#2dd4bf] hover:bg-[#101a25] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload className="size-4" />
                Обрати JSON-файл
              </button>
            </div>

            {restoreError ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#ef4444]/30 bg-[#2b1216] p-3 text-sm leading-6 text-[#fecaca]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{restoreError}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="h-full rounded-lg border border-[#4a2428] bg-[#171014] p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#eef4ff]">
              Очищення даних
            </h3>
            <Trash2 className="size-4 text-[#ff8d7f]" />
          </div>

          <div className="mt-3 grid gap-2">
            <button
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-[#4a2428] bg-[#1e1115] px-3 py-2 text-left text-sm font-semibold text-[#ffb1a7] transition hover:border-[#ef6351] hover:bg-[#251519] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isBusy || materialCount === 0}
              onClick={confirmClearMaterials}
              type="button"
            >
              <span>Видалити всі матеріали</span>
              <span className="font-mono text-xs text-[#ff8d7f]">
                {materialCount}
              </span>
            </button>
            <button
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-[#4a2428] bg-[#1e1115] px-3 py-2 text-left text-sm font-semibold text-[#ffb1a7] transition hover:border-[#ef6351] hover:bg-[#251519] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isBusy || reviewCount === 0}
              onClick={confirmResetStats}
              type="button"
            >
              <span>Обнулити статистику</span>
              <span className="font-mono text-xs text-[#ff8d7f]">
                {reviewCount}
              </span>
            </button>
          </div>
        </div>

        {backupPreview ? (
          <div className="rounded-lg border border-[#314055] bg-[#0b111a] p-4 xl:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PreviewMetric
                label="Дата копії"
                value={formatDate(backupPreview.exportedAt)}
              />
              <PreviewMetric
                label="Матеріали"
                value={`${backupPreview.notes} (${backupPreview.englishNotes} англ. / ${backupPreview.qaNotes} QA)`}
              />
              <PreviewMetric label="Картки" value={backupPreview.cards} />
              <PreviewMetric
                label="Повторення"
                value={backupPreview.reviewLogs}
              />
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#263140] bg-[#101923] p-3 text-sm leading-6 text-[#c7d0dd]">
              <input
                checked={isRestoreConfirmed}
                className="mt-1 size-4 accent-[#2dd4bf]"
                onChange={(event) => setIsRestoreConfirmed(event.target.checked)}
                type="checkbox"
              />
              <span>
                Розумію, що поточні матеріали, картки й історія повторень будуть
                замінені даними з цієї резервної копії.
              </span>
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#9aa8ba]">
                Поточні дані буде замінено.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#314055] px-4 text-sm font-semibold text-[#dce7f5] transition hover:border-[#2dd4bf] hover:bg-[#101a25] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={clearRestorePreview}
                  type="button"
                >
                  Скасувати
                </button>
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 text-sm font-semibold text-[#03110f] transition hover:bg-[#67e8d7] disabled:cursor-not-allowed disabled:bg-[#3a4b60] disabled:text-[#91a0b3]"
                  disabled={!isRestoreConfirmed || isBusy}
                  onClick={() => void handleRestoreClick()}
                  type="button"
                >
                  {isBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Відновити копію
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ShellPanel>
  );
}
