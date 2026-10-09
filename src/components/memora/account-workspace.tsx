"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import {
  CircleHelp,
  Download,
  GraduationCap,
  KeyRound,
  LogOut,
  Minus,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  parseBackupJson,
  previewBackup,
  type BackupDocument,
  type BackupPreview,
} from "@/lib/memora/backup";
import { createBackupJson, notesToCsv } from "@/lib/memora/export";
import type {
  AppSettings,
  MemoraState,
  UserProfile,
  UserProfileDraft,
} from "@/lib/memora/types";
import type { User } from "@supabase/supabase-js";
import type { AppView } from "./types";
import { levelOptions } from "./types";
import { PreviewMetric } from "./account-widgets";
import {
  Button,
  fieldClass,
  FieldLabel,
  PageHeader,
  PasswordInput,
  SectionHeader,
  SegmentedControl,
  ShellPanel,
  StatusBanner,
  TextArea,
} from "./shared-ui";
import { dateStamp, downloadTextFile, formatDate, formatError } from "./utils";

const MAX_DAILY_NEW = 50;

export function AccountWorkspace({
  isBusy,
  isPasswordRecovery,
  profile,
  state,
  user,
  onClearMaterials,
  onNavigate,
  onPasswordUpdate,
  onProfileSave,
  onRestoreBackup,
  onResetLearningStats,
  onSaved,
  onSettingsChange,
  onSignOut,
}: {
  isBusy: boolean;
  isPasswordRecovery: boolean;
  profile: UserProfile | null;
  state: MemoraState;
  user: User | null;
  onClearMaterials: () => Promise<void>;
  onNavigate: (view: AppView) => void;
  onPasswordReset: (email: string) => Promise<void>;
  onPasswordUpdate: (password: string) => Promise<void>;
  onProfileSave: (draft: UserProfileDraft) => Promise<void>;
  onRestoreBackup: (backup: BackupDocument) => Promise<void>;
  onResetLearningStats: () => Promise<void>;
  onSaved: () => void;
  onSettingsChange: (settings: AppSettings) => Promise<void>;
  onSignOut: () => void;
}) {
  const [draft, setDraft] = useState<UserProfileDraft>(() => profileToDraft(profile));
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(() => state.settings);
  const [profileError, setProfileError] = useState<string | null>(null);
  const initialDraft = profileToDraft(profile);
  const hasChanges =
    settingsDraft.dailyNewLimit !== state.settings.dailyNewLimit ||
    settingsDraft.reviewButtons !== state.settings.reviewButtons ||
    draft.level !== initialDraft.level ||
    draft.primaryGoal !== initialDraft.primaryGoal;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);

    try {
      await onProfileSave(draft);
      await onSettingsChange({ ...state.settings, ...pickLearningSettings(settingsDraft) });
      onSaved();
    } catch (error) {
      setProfileError(formatError(error));
    }
  }

  function setDailyNew(value: number) {
    setSettingsDraft((current) => ({
      ...current,
      dailyNewLimit: Math.max(0, Math.min(MAX_DAILY_NEW, Math.round(value))),
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Профіль"
        description={user?.email ?? profile?.email ?? undefined}
        action={
          <>
            <Button className="lg:hidden" icon={CircleHelp} size="sm" onClick={() => onNavigate("help")}>
              Довідка
            </Button>
            <Button className="lg:hidden" icon={LogOut} size="sm" onClick={onSignOut}>
              Вийти
            </Button>
          </>
        }
      />

      {isPasswordRecovery ? (
        <StatusBanner
          tone="success"
          message="Ти перейшов за посиланням для відновлення. Задай новий пароль нижче."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <ShellPanel className="p-5 md:p-6">
          <SectionHeader
            icon={GraduationCap}
            title="Навчання"
            description="Скільки нового брати щодня і як оцінювати відповіді."
          />

          <form className="mt-6 space-y-6" onSubmit={saveProfile}>
            <div>
              <FieldLabel hint="рекомендуємо 5–15">Нових карток на день</FieldLabel>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-xl border border-line-strong bg-surface-1">
                  <button
                    aria-label="Менше"
                    className="grid size-11 place-items-center text-muted transition hover:text-text disabled:opacity-40"
                    disabled={settingsDraft.dailyNewLimit <= 0}
                    onClick={() => setDailyNew(settingsDraft.dailyNewLimit - 1)}
                    type="button"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    aria-label="Нових карток на день"
                    className="h-11 w-14 bg-transparent text-center font-mono text-base font-semibold text-text outline-none"
                    inputMode="numeric"
                    max={MAX_DAILY_NEW}
                    min={0}
                    type="number"
                    value={settingsDraft.dailyNewLimit}
                    onChange={(event) => setDailyNew(Number(event.target.value) || 0)}
                  />
                  <button
                    aria-label="Більше"
                    className="grid size-11 place-items-center text-muted transition hover:text-text disabled:opacity-40"
                    disabled={settingsDraft.dailyNewLimit >= MAX_DAILY_NEW}
                    onClick={() => setDailyNew(settingsDraft.dailyNewLimit + 1)}
                    type="button"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {[5, 10, 20].map((preset) => (
                    <button
                      key={preset}
                      className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
                        settingsDraft.dailyNewLimit === preset
                          ? "border-accent/50 bg-accent-soft text-accent"
                          : "border-line text-muted hover:text-text"
                      }`}
                      onClick={() => setDailyNew(preset)}
                      type="button"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-faint">
                Повторення не обмежуються — ліміт стосується лише нових карток.
              </p>
            </div>

            <div>
              <FieldLabel>Кнопки оцінювання</FieldLabel>
              <SegmentedControl
                ariaLabel="Кнопки оцінювання"
                className="mt-2 w-full sm:w-72"
                options={[
                  { value: "simple", label: "2 кнопки" },
                  { value: "advanced", label: "4 кнопки" },
                ]}
                value={settingsDraft.reviewButtons}
                onChange={(reviewButtons) =>
                  setSettingsDraft((current) => ({ ...current, reviewButtons }))
                }
              />
              <p className="mt-2 text-xs leading-5 text-faint">
                {settingsDraft.reviewButtons === "simple"
                  ? "«Не згадав» і «Згадав». Ідеально для старту."
                  : "Додаються «Важко» та «Легко» — розклад підлаштовується тонше."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-1">
                <FieldLabel>Рівень англійської</FieldLabel>
                <select
                  className={`mt-1.5 h-11 ${fieldClass}`}
                  value={draft.level}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, level: event.target.value }))
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
              label="Навіщо вчу"
              placeholder="Наприклад: впевнено пройти QA-співбесіду англійською"
              rows={2}
              value={draft.primaryGoal}
              onChange={(primaryGoal) => setDraft((current) => ({ ...current, primaryGoal }))}
            />

            {profileError ? <StatusBanner tone="error" message={profileError} /> : null}

            <Button
              className="w-full sm:w-auto"
              disabled={isBusy || !hasChanges}
              icon={Save}
              isLoading={isBusy}
              type="submit"
              variant="primary"
            >
              Зберегти
            </Button>
          </form>
        </ShellPanel>

        <SecurityPanel isBusy={isBusy} onPasswordUpdate={onPasswordUpdate} />
      </div>

      <DataPanel
        isBusy={isBusy}
        state={state}
        onClearMaterials={onClearMaterials}
        onResetLearningStats={onResetLearningStats}
        onRestoreBackup={onRestoreBackup}
      />
    </div>
  );
}

function pickLearningSettings(settings: AppSettings) {
  return {
    dailyNewLimit: settings.dailyNewLimit,
    reviewButtons: settings.reviewButtons,
  };
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

function SecurityPanel({
  isBusy,
  onPasswordUpdate,
}: {
  isBusy: boolean;
  onPasswordUpdate: (password: string) => Promise<void>;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Пароль має містити щонайменше 8 символів.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Паролі не збігаються.");
      return;
    }

    try {
      await onPasswordUpdate(newPassword);
      setNewPassword("");
      setConfirmPassword("");
    } catch (updateError) {
      setError(formatError(updateError));
    }
  }

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader icon={ShieldCheck} title="Пароль" description="Зміни пароль для входу." />
      <form className="mt-6 space-y-4" onSubmit={updatePassword}>
        <PasswordInput
          autoComplete="new-password"
          label="Новий пароль"
          value={newPassword}
          onChange={setNewPassword}
        />
        <PasswordInput
          autoComplete="new-password"
          label="Ще раз"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
        {error ? <StatusBanner tone="error" message={error} /> : null}
        <Button
          className="w-full sm:w-auto"
          disabled={isBusy || !newPassword || !confirmPassword}
          icon={KeyRound}
          type="submit"
        >
          Оновити пароль
        </Button>
      </form>
    </ShellPanel>
  );
}

function DataPanel({
  isBusy,
  onClearMaterials,
  onResetLearningStats,
  onRestoreBackup,
  state,
}: {
  isBusy: boolean;
  onClearMaterials: () => Promise<void>;
  onResetLearningStats: () => Promise<void>;
  onRestoreBackup: (backup: BackupDocument) => Promise<void>;
  state: MemoraState;
}) {
  const [backupDocument, setBackupDocument] = useState<BackupDocument | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoreConfirmed, setIsRestoreConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const materialCount = state.notes.length;
  const reviewCount = state.reviewLogs.length;

  async function handleBackupFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setRestoreError(null);
    setBackupDocument(null);
    setBackupPreview(null);
    setIsRestoreConfirmed(false);

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setRestoreError("Файл завеликий — максимум 10 МБ.");
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
  }

  function confirmClearMaterials() {
    const confirmed = window.confirm(
      `Видалити всі матеріали (${materialCount}) разом із картками та історією? Скасувати це не можна.`,
    );
    if (confirmed) void onClearMaterials().catch(() => undefined);
  }

  function confirmResetStats() {
    const confirmed = window.confirm(
      `Обнулити історію повторень (${reviewCount})? Матеріали залишаться, але всі картки почнуть навчання з нуля.`,
    );
    if (confirmed) void onResetLearningStats().catch(() => undefined);
  }

  const exports = [
    {
      label: "Повна копія",
      hint: "JSON — для відновлення",
      onClick: () =>
        downloadTextFile(
          `memora-backup-${dateStamp()}.json`,
          createBackupJson(state),
          "application/json;charset=utf-8",
        ),
    },
    {
      label: "Слова",
      hint: "CSV-таблиця",
      onClick: () =>
        downloadTextFile(
          `memora-english-${dateStamp()}.csv`,
          notesToCsv(state.notes, "english"),
          "text/csv;charset=utf-8",
        ),
    },
    {
      label: "QA-терміни",
      hint: "CSV-таблиця",
      onClick: () =>
        downloadTextFile(
          `memora-qa-${dateStamp()}.csv`,
          notesToCsv(state.notes, "qa"),
          "text/csv;charset=utf-8",
        ),
    },
  ];

  return (
    <ShellPanel className="p-5 md:p-6">
      <SectionHeader
        icon={Download}
        title="Дані"
        description="Збережи копію своїх матеріалів або віднови їх з файлу."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {exports.map((item) => (
          <button
            key={item.label}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-1 p-4 text-left transition hover:border-accent/50"
            onClick={item.onClick}
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
          <p className="mt-0.5 text-xs text-muted">
            Поточні матеріали й історію буде замінено даними з файлу.
          </p>
        </div>
        <input
          ref={fileInputRef}
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void handleBackupFileChange(event)}
          type="file"
        />
        <Button
          disabled={isBusy}
          icon={Upload}
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Обрати файл
        </Button>
      </div>

      {restoreError ? <StatusBanner className="mt-3" tone="error" message={restoreError} /> : null}

      {backupPreview ? (
        <div className="animate-rise mt-3 rounded-2xl border border-line-strong bg-surface-1 p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <PreviewMetric label="Дата копії" value={formatDate(backupPreview.exportedAt)} />
            <PreviewMetric
              label="Матеріали"
              value={`${backupPreview.notes} (${backupPreview.englishNotes} слів / ${backupPreview.qaNotes} QA)`}
            />
            <PreviewMetric label="Картки" value={backupPreview.cards} />
            <PreviewMetric label="Повторення" value={backupPreview.reviewLogs} />
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-text-2">
            <input
              checked={isRestoreConfirmed}
              className="mt-1 size-4 accent-[var(--accent)]"
              onChange={(event) => setIsRestoreConfirmed(event.target.checked)}
              type="checkbox"
            />
            Розумію, що поточні матеріали, картки й історію буде замінено.
          </label>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={isBusy} size="sm" onClick={clearRestorePreview}>
              Скасувати
            </Button>
            <Button
              disabled={!isRestoreConfirmed || isBusy}
              icon={Upload}
              isLoading={isBusy}
              size="sm"
              variant="primary"
              onClick={() => void handleRestoreClick()}
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
            disabled={isBusy || reviewCount === 0}
            size="sm"
            variant="danger"
            onClick={confirmResetStats}
          >
            Обнулити статистику
            <span className="font-mono text-xs opacity-80">{reviewCount}</span>
          </Button>
          <Button
            className="justify-between"
            disabled={isBusy || materialCount === 0}
            size="sm"
            variant="danger"
            onClick={confirmClearMaterials}
          >
            Видалити всі матеріали
            <span className="font-mono text-xs opacity-80">{materialCount}</span>
          </Button>
        </div>
      </details>
    </ShellPanel>
  );
}
