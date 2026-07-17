"use client";

import {
  Activity,
  AlertCircle,
  Archive,
  BarChart3,
  BookOpenCheck,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  FileText,
  Flame,
  Gauge,
  Globe2,
  KeyRound,
  Languages,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  Menu,
  PauseCircle,
  Plus,
  PlayCircle,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserCircle,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEnglishNoteAction,
  addQaNoteAction,
  importEnglishNotesAction,
  importQaNotesAction,
  loadProfileAction,
  loadMemoraStateAction,
  reviewCardAction,
  restoreBackupAction,
  suspendCardAction,
  updateCardStatusAction,
  updateNoteContentAction,
  updateNoteStatusAction,
  updateProfileAction,
  updateSettingsAction,
} from "@/app/actions";
import {
  generateEnglishCards,
  generateQaCards,
  normalizeEnglishDraft,
  normalizeQaDraft,
  type EnglishDraft,
  type QaDraft,
} from "@/lib/memora/card-generator";
import {
  csvTemplate,
  parseCsvImport,
  type CsvImportDraft,
  type CsvImportPreview,
} from "@/lib/memora/csv-import";
import { findDuplicateNotes } from "@/lib/memora/duplicates";
import { createBackupJson, notesToCsv } from "@/lib/memora/export";
import {
  parseBackupJson,
  previewBackup,
  type BackupDocument,
  type BackupPreview,
} from "@/lib/memora/backup";
import {
  getDueQueue,
  summarizeState,
  topicStats,
} from "@/lib/memora/store";
import {
  type NoteContentDraft,
} from "@/lib/memora/remote-store";
import type {
  AppSettings,
  ImportRun,
  MemoraState,
  ModuleType,
  Note,
  QueueSummary,
  ReviewRating,
  StudyCard,
  StudyMode,
  UserProfile,
  UserProfileDraft,
} from "@/lib/memora/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DraftMode = "english" | "qa";
type AppView = "today" | "english" | "qa" | "analytics" | "account" | "help";
type ItemStatus = "active" | "suspended" | "archived";
type IconType = typeof Target;
type ImportResultSummary = {
  importedCount: number;
  skippedDuplicates: number;
  invalidRows: number;
};
type ClientImportCommitRow = {
  rowNumber: number;
  draft?: CsvImportDraft;
  errors?: string[];
  raw?: Record<string, string>;
};

const localeOptions = [{ value: "uk-UA", label: "Українська" }];
const timezoneOptions = [
  { value: "Europe/Kiev", label: "Київ" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/Warsaw", label: "Варшава" },
  { value: "Europe/London", label: "Лондон" },
  { value: "America/New_York", label: "Нью-Йорк" },
];
const levelOptions = [
  { value: "", label: "Не вказувати" },
  { value: "beginner", label: "Початковий" },
  { value: "intermediate", label: "Середній" },
  { value: "advanced", label: "Впевнений" },
];

const modeLabels: Record<StudyMode, string> = {
  daily: "Усе",
  "english-productive": "Англійська",
  "qa-interview": "QA",
};

const navigationItems: Array<{ view: AppView; label: string; icon: IconType }> = [
  { view: "today", label: "Практика", icon: Target },
  { view: "english", label: "Англійські слова", icon: Languages },
  { view: "qa", label: "QA та тестування", icon: Code2 },
  { view: "analytics", label: "Прогрес", icon: BarChart3 },
  { view: "account", label: "Профіль", icon: UserCircle },
  { view: "help", label: "Як користуватись", icon: FileText },
];

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Невідома помилка.");
  }

  return "Щось пішло не так. Спробуй ще раз.";
}

function unwrapActionState(result: {
  ok: true;
  state: MemoraState;
} | {
  ok: false;
  error: string;
}) {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function unwrapProfile(result: {
  ok: true;
  profile: UserProfile;
} | {
  ok: false;
  error: string;
}) {
  if (!result.ok) throw new Error(result.error);
  return result.profile;
}

export function MemoraApp() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [authStatus, setAuthStatus] = useState<
    "loading" | "signed-out" | "signed-in"
  >("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [state, setState] = useState<MemoraState | null>(null);
  const [activeView, setActiveView] = useState<AppView>("today");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [, setIsLoadingData] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const loadingUserIdRef = useRef<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);

  const resetPracticeUi = useCallback(() => {
    setActiveCardId(null);
    setResponseText("");
    setIsRevealed(false);
    setStartedAt(Date.now());
  }, []);

  const loadUserData = useCallback(
    async (nextUser: User, options: { force?: boolean } = {}) => {
      if (
        !options.force &&
        (loadingUserIdRef.current === nextUser.id ||
          loadedUserIdRef.current === nextUser.id)
      ) {
        return;
      }

      loadingUserIdRef.current = nextUser.id;
      setIsLoadingData(true);
      setErrorMessage(null);

      try {
        const [stateResult, profileResult] = await Promise.all([
          loadMemoraStateAction(),
          loadProfileAction(),
        ]);
        const nextState = unwrapActionState(stateResult);
        const nextProfile = unwrapProfile(profileResult);
        setState(nextState);
        setProfile(nextProfile);
        loadedUserIdRef.current = nextUser.id;
      } catch (error) {
        setErrorMessage(formatError(error));
      } finally {
        if (loadingUserIdRef.current === nextUser.id) {
          loadingUserIdRef.current = null;
        }
        setIsLoadingData(false);
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        setAuthStatus("signed-out");
        setErrorMessage(formatError(error));
        return;
      }

      if (!data.session?.user) {
        setAuthStatus("signed-out");
        setUser(null);
        setProfile(null);
        setState(null);
        setIsPasswordRecovery(false);
        return;
      }

      setAuthStatus("signed-in");
      setUser(data.session.user);
      void loadUserData(data.session.user);
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (!session?.user) {
        setAuthStatus("signed-out");
        setUser(null);
        setProfile(null);
        setState(null);
        setIsPasswordRecovery(false);
        setIsLoadingData(false);
        loadingUserIdRef.current = null;
        loadedUserIdRef.current = null;
        resetPracticeUi();
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        setActiveView("account");
        setStatusMessage("Введи новий пароль, щоб завершити відновлення доступу.");
      }

      setAuthStatus("signed-in");
      setUser(session.user);
      void loadUserData(session.user);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData, resetPracticeUi, supabase]);

  const queue = useMemo(
    () => (state ? getDueQueue(state, state.settings.studyMode) : []),
    [state],
  );

  const summary = useMemo(() => (state ? summarizeState(state) : null), [state]);

  const activeCard =
    queue.find((card) => card.id === activeCardId) ?? queue.at(0) ?? null;

  const contentModule: ModuleType | null =
    activeView === "english" || activeView === "qa" ? activeView : null;
  const contentNotes = useMemo(
    () =>
      state && contentModule
        ? state.notes.filter((note) => note.module === contentModule)
        : [],
    [contentModule, state],
  );
  const selectedNote =
    contentNotes.find((note) => note.id === selectedNoteId) ??
    contentNotes.at(0) ??
    null;
  const currentViewLabel =
    navigationItems.find((item) => item.view === activeView)?.label ?? "Memora";

  const navigateToView = useCallback((view: AppView) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  }, []);

  const handleOpenNote = useCallback((note: Note) => {
    setActiveView(note.module);
    setSelectedNoteId(note.id);
  }, []);

  async function handleSignIn(email: string, password: string) {
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }

  async function handleSignUp(email: string, password: string) {
    setErrorMessage(null);
    setStatusMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (!data.session) {
      setStatusMessage("Обліковий запис створено. Якщо підтвердження увімкнене, перевір пошту і перейди за посиланням.");
      return;
    }

    setStatusMessage("Обліковий запис створено. Готую твою Memora.");
  }

  async function handlePasswordReset(email: string) {
    const cleanEmail = email.trim();
    if (!cleanEmail) throw new Error("Вкажи email, щоб надіслати лист для відновлення.");

    setErrorMessage(null);
    setStatusMessage(null);

    const redirectTo =
      typeof window === "undefined" ? undefined : window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) throw error;

    setStatusMessage("Лист для відновлення пароля надіслано. Перевір пошту.");
  }

  async function handleSignOut() {
    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setAuthStatus("signed-out");
      setUser(null);
      setProfile(null);
      setState(null);
      setIsPasswordRecovery(false);
      loadingUserIdRef.current = null;
      loadedUserIdRef.current = null;
      resetPracticeUi();
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSettingsChange(settings: AppSettings) {
    if (!state) return;

    const previousState = state;
    const nextState = { ...state, settings };
    setState(nextState);
    setErrorMessage(null);

    try {
      const updatedState = unwrapActionState(await updateSettingsAction(settings));
      setState(updatedState);
    } catch (error) {
      setState(previousState);
      setErrorMessage(formatError(error));
    }
  }

  async function handleProfileSave(draft: UserProfileDraft) {
    if (isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextProfile = unwrapProfile(await updateProfileAction(draft));
      setProfile(nextProfile);
      setStatusMessage("Налаштування акаунта збережено.");
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handlePasswordUpdate(password: string) {
    if (isMutating) return;

    const nextPassword = password.trim();
    if (nextPassword.length < 8) {
      throw new Error("Новий пароль має містити мінімум 8 символів.");
    }

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) throw error;

      setIsPasswordRecovery(false);
      setStatusMessage("Пароль оновлено.");
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function submitReview(rating: ReviewRating) {
    if (!state || !activeCard || responseText.trim().length === 0 || isMutating) {
      return;
    }

    const elapsedMs = Date.now() - startedAt;
    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(
        await reviewCardAction({
          cardId: activeCard.id,
          rating,
          responseText: responseText.trim(),
          elapsedMs,
        }),
      );
      setState(nextState);
      resetPracticeUi();
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSuspend(cardId: string) {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const nextState = unwrapActionState(await suspendCardAction(cardId));
      setState(nextState);
      resetPracticeUi();
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleCardStatusChange(
    cardId: string,
    status: ItemStatus,
  ) {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(
        await updateCardStatusAction(cardId, status),
      );
      setState(nextState);
      setStatusMessage(`Картку оновлено: ${labelStatus(status)}.`);
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleNoteStatusChange(
    noteId: string,
    status: ItemStatus,
  ) {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(
        await updateNoteStatusAction(noteId, status),
      );
      setState(nextState);
      setStatusMessage(`Матеріал оновлено: ${labelStatus(status)}.`);
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleNoteContentChange(
    noteId: string,
    content: NoteContentDraft,
  ) {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(
        await updateNoteContentAction(noteId, content),
      );
      setState(nextState);
      setStatusMessage("Матеріал збережено.");
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAddEnglish(draft: EnglishDraft) {
    if (isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const nextState = unwrapActionState(await addEnglishNoteAction(draft));
      setState(nextState);
      setStatusMessage("Додано англійський матеріал та 2 картки.");
      resetPracticeUi();
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAddQa(draft: QaDraft) {
    if (isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const nextState = unwrapActionState(await addQaNoteAction(draft));
      setState(nextState);
      setStatusMessage("Додано матеріал з тестування та 2 картки.");
      resetPracticeUi();
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleImportNotes(
    moduleType: ModuleType,
    rows: ClientImportCommitRow[],
    skipDuplicates: boolean,
    fileName: string | null,
  ): Promise<ImportResultSummary> {
    if (isMutating) {
      return { importedCount: 0, skippedDuplicates: 0, invalidRows: 0 };
    }

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result =
        moduleType === "english"
          ? await importEnglishNotesAction(
              rows as Array<ClientImportCommitRow & { draft?: EnglishDraft }>,
              {
                fileName: fileName ?? undefined,
                skipDuplicates,
              },
            )
          : await importQaNotesAction(
              rows as Array<ClientImportCommitRow & { draft?: QaDraft }>,
              {
                fileName: fileName ?? undefined,
                skipDuplicates,
              },
            );

      if (!result.ok) throw new Error(result.error);

      setState(result.state);
      resetPracticeUi();
      setStatusMessage(
        result.skippedDuplicates > 0
          ? `Додано з CSV: ${result.importedCount}; пропущено схожих записів: ${result.skippedDuplicates}; помилок: ${result.invalidRows}.`
          : `Додано з CSV: ${result.importedCount}; помилок: ${result.invalidRows}.`,
      );

      return {
        importedCount: result.importedCount,
        skippedDuplicates: result.skippedDuplicates,
        invalidRows: result.invalidRows,
      };
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRestoreBackup(backup: BackupDocument) {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(await restoreBackupAction(backup));
      setState(nextState);
      setSelectedNoteId(null);
      resetPracticeUi();
      setStatusMessage(
        `Резервну копію відновлено: ${nextState.notes.length} матеріалів, ${nextState.cards.length} карток, ${nextState.reviewLogs.length} повторень.`,
      );
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  if (authStatus === "loading") {
    return (
      <CenteredStatus
        title="Підключаю Memora"
        description="Перевіряю сесію і готую твій навчальний простір."
      />
    );
  }

  if (authStatus === "signed-out") {
    return (
      <AuthPanel
        errorMessage={errorMessage}
        statusMessage={statusMessage}
        onResetPassword={handlePasswordReset}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    );
  }

  if (!state || !summary) {
    return (
      <CenteredStatus
        title="Завантажую Memora"
        description="Завантажую матеріали, картки й історію повторень."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#070a0f] text-[#eef4ff]">
      <MobileTopBar
        activeView={activeView}
        currentViewLabel={currentViewLabel}
        isBusy={isMutating}
        isOpen={isMobileMenuOpen}
        userEmail={user?.email}
        onNavigate={navigateToView}
        onSignOut={() => {
          setIsMobileMenuOpen(false);
          void handleSignOut();
        }}
        onToggle={() => setIsMobileMenuOpen((value) => !value)}
      />

      <div className="mx-auto flex w-full max-w-[1440px] gap-4 px-3 pb-4 pt-3 md:px-5 lg:gap-5 lg:px-6 lg:py-4">
        <aside className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)] lg:w-72">
          <ShellPanel className="flex h-full flex-col justify-between p-4">
            <div>
              <BrandLockup />
              <NavigationList
                activeView={activeView}
                className="mt-7"
                onNavigate={navigateToView}
              />
            </div>

            <div className="mt-6 space-y-3">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
                title={user?.email ?? "Вийти"}
                disabled={isMutating}
                onClick={() => void handleSignOut()}
              >
                <LogOut className="size-4" />
                Вийти
              </button>
            </div>
          </ShellPanel>
        </aside>

        <section className="min-w-0 flex-1 space-y-4 md:space-y-5">
          {errorMessage || statusMessage ? (
            <div className="space-y-3">
              {errorMessage ? (
                <StatusBanner tone="error" message={errorMessage} />
              ) : null}
              {statusMessage ? (
                <StatusBanner tone="success" message={statusMessage} />
              ) : null}
            </div>
          ) : null}

          {activeView === "today" ? (
            <ShellPanel className="p-3 md:p-4">
              <div className="flex justify-end">
                <ModeSelector
                  value={state.settings.studyMode}
                  onChange={(studyMode) => {
                    void handleSettingsChange({
                      ...state.settings,
                      studyMode,
                    });
                    resetPracticeUi();
                  }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <Metric
                  icon={ListChecks}
                  label="Повторити"
                  value={summary.dueReviews.toString()}
                  accent="bg-[#2dd4bf]"
                />
                <Metric
                  icon={Plus}
                  label="Нові"
                  value={summary.newAvailable.toString()}
                  accent="bg-[#8b7cf6]"
                />
                <Metric
                  icon={Clock3}
                  label="Час"
                  value={`${summary.estimatedMinutes} хв`}
                  accent="bg-[#f2a84a]"
                />
                <Metric
                  icon={Gauge}
                  label="Якість"
                  value={formatPercent(summary.retention)}
                  accent="bg-[#ef6351]"
                />
                <Metric
                  icon={Flame}
                  label="Закріплені"
                  value={summary.matureCards.toString()}
                  accent="bg-[#202938]"
                />
              </div>
            </ShellPanel>
          ) : null}

          {activeView === "today" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-5">
              <StudyPanel
                card={activeCard}
                queueLength={queue.length}
                responseText={responseText}
                isRevealed={isRevealed}
                isBusy={isMutating}
                reviewButtons={state.settings.reviewButtons}
                onResponseChange={setResponseText}
                onReveal={() => setIsRevealed(true)}
                onReview={(rating) => void submitReview(rating)}
                onSuspend={(cardId) => void handleSuspend(cardId)}
              />

              <div className="space-y-5">
                <AddNotePanel
                  isBusy={isMutating}
                  notes={state.notes}
                  onAddEnglish={handleAddEnglish}
                  onAddQa={handleAddQa}
                  onOpenNote={handleOpenNote}
                />
              </div>
            </div>
          ) : activeView === "account" ? (
            <AccountWorkspace
              key={profile?.updatedAt ?? user?.id ?? "account"}
              isBusy={isMutating}
              isPasswordRecovery={isPasswordRecovery}
              profile={profile}
              state={state}
              user={user}
              onPasswordReset={handlePasswordReset}
              onPasswordUpdate={handlePasswordUpdate}
              onProfileSave={handleProfileSave}
              onSettingsChange={(settings) => void handleSettingsChange(settings)}
            />
          ) : activeView === "help" ? (
            <HelpWorkspace />
          ) : activeView === "analytics" ? (
            <AnalyticsWorkspace
              isBusy={isMutating}
              state={state}
              summary={summary}
              onRestoreBackup={handleRestoreBackup}
            />
          ) : contentModule ? (
            <ContentManager
              cards={state.cards}
              imports={state.imports}
              isBusy={isMutating}
              moduleType={contentModule}
              notes={contentNotes}
              selectedNote={selectedNote}
              onCardStatusChange={(cardId, status) =>
                void handleCardStatusChange(cardId, status)
              }
              onNoteContentChange={handleNoteContentChange}
              onNoteSelect={setSelectedNoteId}
              onNoteStatusChange={(noteId, status) =>
                void handleNoteStatusChange(noteId, status)
              }
              onImport={(rows, skipDuplicates, fileName) =>
                handleImportNotes(contentModule, rows, skipDuplicates, fileName)
              }
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#202938] text-white">
        <Brain className="size-5" />
      </div>
      <p className="text-lg font-semibold leading-6">Memora</p>
    </div>
  );
}

function NavigationList({
  activeView,
  className = "",
  onNavigate,
}: {
  activeView: AppView;
  className?: string;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <nav className={`space-y-2 ${className}`}>
      {navigationItems.map((item) => (
        <NavItem
          key={item.view}
          icon={item.icon}
          label={item.label}
          active={activeView === item.view}
          onClick={() => onNavigate(item.view)}
        />
      ))}
    </nav>
  );
}

function MobileTopBar({
  activeView,
  currentViewLabel,
  isBusy,
  isOpen,
  onNavigate,
  onSignOut,
  onToggle,
  userEmail,
}: {
  activeView: AppView;
  currentViewLabel: string;
  isBusy: boolean;
  isOpen: boolean;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
  onToggle: () => void;
  userEmail?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#202938] bg-[#070a0f]/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-3">
        <BrandLockup />
        <div className="flex items-center gap-2">
          {!isOpen ? (
            <span className="max-w-[150px] truncate text-sm font-medium text-[#9aa8ba]">
              {currentViewLabel}
            </span>
          ) : null}
          <button
            className="grid size-10 place-items-center rounded-lg border border-[#263140] text-[#c7d0dd]"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Закрити меню" : "Відкрити меню"}
            onClick={onToggle}
            type="button"
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="border-t border-[#202938] px-3 pb-3">
          <ShellPanel className="p-3">
            <NavigationList activeView={activeView} onNavigate={onNavigate} />
            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd]"
              title={userEmail ?? "Вийти"}
              disabled={isBusy}
              onClick={onSignOut}
              type="button"
            >
              <LogOut className="size-4" />
              Вийти
            </button>
          </ShellPanel>
        </div>
      ) : null}
    </header>
  );
}

function ShellPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[#263140] bg-[#10161f] shadow-[0_18px_70px_rgba(0,0,0,0.34)] ${className}`}
    >
      {children}
    </div>
  );
}

function CenteredStatus({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070a0f] px-4 text-[#eef4ff]">
      <ShellPanel className="w-full max-w-md p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#9aa8ba]">{description}</p>
      </ShellPanel>
    </main>
  );
}

function AuthPanel({
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
          <div className="flex min-h-[520px] flex-col justify-between border-b border-[#263140] bg-[#0d131c] p-6 md:border-b-0 md:border-r">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-lg bg-[#202938] text-white">
                  <Brain className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-semibold">Memora</p>
                  <p className="text-sm text-[#9aa8ba]">Особистий простір для навчання</p>
                </div>
              </div>
              <h1 className="mt-10 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">
                Вчи англійські слова й терміни з тестування через регулярне пригадування.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#9aa8ba]">
                Memora підказує, що варто повторити сьогодні, і поступово додає
                нові слова та QA-терміни без перевантаження.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Фокус" value="Англ." />
              <MiniStat label="Фокус" value="Тестування" />
              <MiniStat label="Ритм" value="Щодня" />
            </div>
          </div>

          <form className="p-5 md:p-6" onSubmit={submitAuth}>
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

function StatusBanner({
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

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: IconType;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium ${
        active
          ? "bg-[#14352f] text-[#52e0c4]"
          : "text-[#9aa8ba] hover:bg-[#151d28]"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function ModeSelector({
  value,
  onChange,
}: {
  value: StudyMode;
  onChange: (mode: StudyMode) => void;
}) {
  return (
    <div className="grid w-full grid-cols-3 gap-1 rounded-lg border border-[#263140] bg-[#151d28] p-1 sm:w-auto sm:min-w-[420px]">
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

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: IconType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="min-h-24 rounded-lg border border-[#263140] bg-[#0d131c] p-3 md:min-h-28 md:p-4">
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

function StudyPanel({
  card,
  queueLength,
  responseText,
  isRevealed,
  isBusy,
  reviewButtons,
  onResponseChange,
  onReveal,
  onReview,
  onSuspend,
}: {
  card: StudyCard | null;
  queueLength: number;
  responseText: string;
  isRevealed: boolean;
  isBusy: boolean;
  reviewButtons: "simple" | "advanced";
  onResponseChange: (value: string) => void;
  onReveal: () => void;
  onReview: (rating: ReviewRating) => void;
  onSuspend: (cardId: string) => void;
}) {
  if (!card) {
    return (
      <ShellPanel className="grid min-h-[560px] place-items-center p-6">
        <EmptyState
          icon={Check}
          title="Черга порожня"
          description="Активних карток у цьому режимі немає."
        />
      </ShellPanel>
    );
  }

  const revealDisabled = responseText.trim().length === 0;
  const cardStage = card.schedule.reps === 0 ? "Нова" : "Повторення";

  return (
    <ShellPanel className="min-h-[560px] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263140] pb-4">
        <p className="text-sm text-[#9aa8ba]">
          {card.module === "english" ? "Англійська" : "QA"} /{" "}
          {labelCardType(card.type)} / {cardStage}
        </p>
        <div className="flex items-center gap-2 text-sm text-[#9aa8ba]">
          <Activity className="size-4" />
          1 / {queueLength}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-[#9aa8ba]">Питання</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">
          {card.prompt}
        </h2>
      </div>

      <label className="mt-7 block">
        <span className="text-sm font-medium text-[#9aa8ba]">Відповідь</span>
        <textarea
          className="mt-2 min-h-32 w-full resize-none rounded-lg border border-[#263140] bg-[#0b111a] p-4 text-base text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
          value={responseText}
          onChange={(event) => onResponseChange(event.target.value)}
          placeholder="Напиши з пам'яті."
        />
      </label>

      {!isRevealed ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
            disabled={revealDisabled || isBusy}
            onClick={onReveal}
          >
            Перевірити відповідь
            <ChevronRight className="size-4" />
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[#263140] px-4 py-3 text-sm font-medium text-[#c7d0dd] transition hover:border-[#ef6351] hover:text-[#ff8d7f]"
            title="Призупинити цю картку"
            disabled={isBusy}
            onClick={() => onSuspend(card.id)}
          >
            <Archive className="size-4" />
            Поставити на паузу
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-[#263140] bg-[#151d28] p-4">
            <p className="text-sm font-medium text-[#9aa8ba]">Відповідь</p>
            <p className="mt-2 text-xl font-semibold">{card.answer}</p>
            <p className="mt-3 text-sm leading-6 text-[#c7d0dd]">
              {card.explanation}
            </p>
            {card.example ? (
              <p className="mt-3 rounded-md bg-[#0b111a] p-3 text-sm text-[#c7d0dd]">
                {card.example}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <GradeButton
              tone="red"
              label="Знову"
              disabled={isBusy}
              onClick={() => onReview("again")}
            />
            {reviewButtons === "advanced" ? (
              <GradeButton
                tone="amber"
                label="Важко"
                disabled={isBusy}
                onClick={() => onReview("hard")}
              />
            ) : null}
            <GradeButton
              tone="green"
              label="Добре"
              disabled={isBusy}
              onClick={() => onReview("good")}
            />
            {reviewButtons === "advanced" ? (
              <GradeButton
                tone="dark"
                label="Легко"
                disabled={isBusy}
                onClick={() => onReview("easy")}
              />
            ) : null}
          </div>
        </div>
      )}
    </ShellPanel>
  );
}

function GradeButton({
  tone,
  label,
  disabled = false,
  onClick,
}: {
  tone: "red" | "amber" | "green" | "dark";
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const classes = {
    red: "bg-[#ef6351] hover:bg-[#d95645]",
    amber: "bg-[#f2a84a] text-[#071018] hover:bg-[#ffc063]",
    green: "bg-[#2dd4bf] text-[#071018] hover:bg-[#5eead4]",
    dark: "bg-[#202938] hover:bg-[#344052]",
  };

  return (
    <button
      className={`inline-flex min-w-24 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-55 ${classes[tone]}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EmptyState({
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

function AddNotePanel({
  isBusy,
  notes,
  onAddEnglish,
  onAddQa,
  onOpenNote,
}: {
  isBusy: boolean;
  notes: Note[];
  onAddEnglish: (draft: EnglishDraft) => Promise<void>;
  onAddQa: (draft: QaDraft) => Promise<void>;
  onOpenNote: (note: Note) => void;
}) {
  const [mode, setMode] = useState<DraftMode>("english");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [english, setEnglish] = useState<EnglishDraft>({
    lemma: "",
    translation: "",
    example: "",
  });
  const [qa, setQa] = useState<QaDraft>({
    term: "",
    definition: "",
    example: "",
  });

  const normalizedEnglish = useMemo(
    () => normalizeEnglishDraft(english),
    [english],
  );
  const normalizedQa = useMemo(() => normalizeQaDraft(qa), [qa]);
  const canSubmit =
    mode === "english"
      ? Boolean(normalizedEnglish.lemma && normalizedEnglish.translation)
      : Boolean(normalizedQa.term && normalizedQa.definition);
  const previewCards = useMemo(
    () =>
      mode === "english"
        ? generateEnglishCards(normalizedEnglish)
        : generateQaCards(normalizedQa),
    [mode, normalizedEnglish, normalizedQa],
  );
  const duplicateMatches = useMemo(
    () =>
      mode === "english"
        ? findDuplicateNotes(notes, {
            module: "english",
            lemma: normalizedEnglish.lemma,
          })
        : findDuplicateNotes(notes, {
            module: "qa",
            term: normalizedQa.term,
          }),
    [mode, normalizedEnglish.lemma, normalizedQa.term, notes],
  );
  const validationMessages = useMemo(() => {
    if (mode === "english") {
      return [
        normalizedEnglish.lemma.length > 0 && normalizedEnglish.lemma.length < 2
          ? "Слово або фраза надто короткі."
          : null,
        normalizedEnglish.translation.length > 0 &&
        normalizedEnglish.translation.length < 2
          ? "Значення надто коротке."
          : null,
      ].filter(Boolean) as string[];
    }

    return [
      normalizedQa.term.length > 0 && normalizedQa.term.length < 2
        ? "Термін надто короткий."
        : null,
      normalizedQa.definition.length > 0 && normalizedQa.definition.length < 12
        ? "Пояснення надто коротке."
        : null,
    ].filter(Boolean) as string[];
  }, [mode, normalizedEnglish, normalizedQa]);
  const blockingDuplicate = duplicateMatches.length > 0 && !allowDuplicate;
  const submitDisabled = !canSubmit || blockingDuplicate || isBusy || isSubmitting;
  const primaryDuplicate = duplicateMatches.at(0)?.note ?? null;

  return (
    <ShellPanel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Додати матеріал</h2>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-[#263140] bg-[#151d28] p-1">
          <button
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "english"
                ? "bg-[#2dd4bf] text-[#071018] shadow-sm"
                : "text-[#9aa8ba]"
            }`}
            onClick={() => {
              setMode("english");
              setAllowDuplicate(false);
              setSuccessMessage(null);
            }}
            title="Англійський матеріал"
          >
            Англ.
          </button>
          <button
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "qa"
                ? "bg-[#2dd4bf] text-[#071018] shadow-sm"
                : "text-[#9aa8ba]"
            }`}
            onClick={() => {
              setMode("qa");
              setAllowDuplicate(false);
              setSuccessMessage(null);
            }}
            title="Термін або поняття з тестування"
          >
            QA
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {mode === "english" ? (
          <>
            <TextInput
              label="Слово або фраза"
              value={english.lemma}
              onChange={(lemma) => {
                setEnglish((current) => ({ ...current, lemma }));
                setAllowDuplicate(false);
                setSuccessMessage(null);
              }}
              placeholder="flaky test"
            />
            <TextInput
              label="Значення"
              value={english.translation}
              onChange={(translation) =>
                setEnglish((current) => ({ ...current, translation }))
              }
              placeholder="нестабільний тест"
            />
            <TextInput
              label="Приклад"
              value={english.example}
              onChange={(example) =>
                setEnglish((current) => ({ ...current, example }))
              }
              placeholder="This flaky test fails only in CI."
            />
          </>
        ) : (
          <>
            <TextInput
              label="Термін"
              value={qa.term}
              onChange={(term) => {
                setQa((current) => ({ ...current, term }));
                setAllowDuplicate(false);
                setSuccessMessage(null);
              }}
              placeholder="Smoke testing"
            />
            <TextInput
              label="Пояснення"
              value={qa.definition}
              onChange={(definition) =>
                setQa((current) => ({ ...current, definition }))
              }
              placeholder="Швидка перевірка, що критичні функції досі працюють."
            />
            <TextInput
              label="Приклад"
              value={qa.example}
              onChange={(example) => setQa((current) => ({ ...current, example }))}
              placeholder="Після деплою запусти smoke-перевірки."
            />
          </>
        )}
      </div>

      {validationMessages.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[#3b4656] bg-[#121a25] px-3 py-2 text-sm text-[#c7d0dd]">
          {validationMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {duplicateMatches.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[#8a6a2d] bg-[#231b0d] p-3 text-sm text-[#f7d58b]">
          <div className="flex items-center gap-2 font-semibold text-[#ffd98a]">
            <AlertCircle className="size-4" />
            Схожий запис уже є
          </div>
          <div className="mt-2 space-y-2">
            {duplicateMatches.map((match) => (
              <div
                key={match.note.id}
                className="rounded-md border border-[#3a2e18] bg-[#15110a] p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#fff0c2]">{match.note.title}</span>
                  <span className="rounded bg-[#3a2e18] px-2 py-0.5 text-xs uppercase tracking-[0.12em]">
                    {match.confidence}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#d9b76f]">
                  Схожість за полем: {labelDuplicateField(match.matchedOn)}. Стан: {labelStatus(match.note.status)}.
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="rounded-lg border border-[#8a6a2d] px-3 py-2 font-medium text-[#fff0c2] transition hover:bg-[#3a2e18]"
              disabled={!primaryDuplicate}
              onClick={() => {
                if (primaryDuplicate) onOpenNote(primaryDuplicate);
              }}
            >
              Відкрити наявну
            </button>
            <button
              className="rounded-lg bg-[#f2a84a] px-3 py-2 font-semibold text-[#071018] transition hover:bg-[#ffc063]"
              onClick={() => setAllowDuplicate(true)}
            >
              Створити все одно
            </button>
          </div>
        </div>
      ) : null}

      {previewCards.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[#263140] bg-[#0b111a] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#c7d0dd]">
            <Sparkles className="size-4 text-[#52e0c4]" />
            Картки
          </div>
          <div className="mt-3 space-y-2">
            {previewCards.map((card) => (
              <div
                key={card.type}
                className="rounded-md border border-[#202938] bg-[#101822] p-2"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-[#6f7d90]">
                  {labelCardType(card.type)}
                </p>
                <p className="mt-1 text-sm font-medium text-[#eef4ff]">
                  {card.prompt}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
        disabled={submitDisabled}
        onClick={async () => {
          if (submitDisabled) return;

          setIsSubmitting(true);
          setSuccessMessage(null);

          try {
            if (mode === "english") {
              await onAddEnglish(normalizedEnglish);
              setEnglish({ lemma: "", translation: "", example: "" });
              setSuccessMessage("Додано англійський матеріал та 2 картки.");
            } else {
              await onAddQa(normalizedQa);
              setQa({ term: "", definition: "", example: "" });
              setSuccessMessage("Додано матеріал з тестування та 2 картки.");
            }
            setAllowDuplicate(false);
          } catch {
            // Parent component surfaces the Supabase error and keeps the draft intact.
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {blockingDuplicate
          ? "Схожий запис"
          : allowDuplicate
            ? "Додати все одно"
            : "Додати"}
      </button>
      {successMessage ? (
        <p className="mt-3 rounded-lg border border-[#256b60] bg-[#102b27] px-3 py-2 text-sm text-[#8df3dd]">
          {successMessage}
        </p>
      ) : null}
    </ShellPanel>
  );
}

function SettingsPanel({
  state,
  onChange,
}: {
  state: MemoraState;
  onChange: (state: MemoraState) => void;
}) {
  return (
    <ShellPanel className="p-4">
      <h2 className="text-lg font-semibold">Навчання</h2>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Нових на день</span>
          <input
            className="mt-2 w-full accent-[#2dd4bf]"
            type="range"
            min="0"
            max="20"
            value={state.settings.dailyNewLimit}
            onChange={(event) =>
              onChange({
                ...state,
                settings: {
                  ...state.settings,
                  dailyNewLimit: Number(event.target.value),
                },
              })
            }
          />
          <span className="font-mono text-sm text-[#9aa8ba]">
            {state.settings.dailyNewLimit}/день
          </span>
        </label>

        <div>
          <p className="text-sm font-medium">Оцінювання</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["simple", "advanced"] as const).map((mode) => (
              <button
                key={mode}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                  state.settings.reviewButtons === mode
                    ? "border-[#2dd4bf] bg-[#14352f] text-[#52e0c4]"
                    : "border-[#263140] text-[#9aa8ba]"
                }`}
                onClick={() =>
                  onChange({
                    ...state,
                    settings: { ...state.settings, reviewButtons: mode },
                  })
                }
              >
                {mode === "simple" ? "2 кнопки" : "4 кнопки"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ShellPanel>
  );
}

function ContentManager({
  cards,
  imports,
  isBusy,
  moduleType,
  notes,
  selectedNote,
  onCardStatusChange,
  onImport,
  onNoteContentChange,
  onNoteSelect,
  onNoteStatusChange,
}: {
  cards: StudyCard[];
  imports: ImportRun[];
  isBusy: boolean;
  moduleType: ModuleType;
  notes: Note[];
  selectedNote: Note | null;
  onCardStatusChange: (cardId: string, status: ItemStatus) => void;
  onImport: (
    rows: ClientImportCommitRow[],
    skipDuplicates: boolean,
    fileName: string | null,
  ) => Promise<ImportResultSummary>;
  onNoteContentChange: (
    noteId: string,
    content: NoteContentDraft,
  ) => Promise<void>;
  onNoteSelect: (noteId: string) => void;
  onNoteStatusChange: (noteId: string, status: ItemStatus) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNotes = normalizedQuery
    ? notes.filter((note) => noteMatchesQuery(note, normalizedQuery))
    : notes;
  const selectedCards = selectedNote
    ? cards
        .filter((card) => card.noteId === selectedNote.id)
        .sort((a, b) => statusRank(a.status) - statusRank(b.status))
    : [];
  const activeCards = cards.filter(
    (card) => card.module === moduleType && card.status === "active",
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <ShellPanel className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Матеріали</h2>
          <span className="font-mono text-sm text-[#9aa8ba]">{notes.length}</span>
        </div>

        <label className="mt-4 flex h-11 items-center gap-2 rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#c7d0dd]">
          <Search className="size-4 text-[#6f7d90]" />
          <input
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#6f7d90]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Активні" value={activeCards.length.toString()} />
          <MiniStat
            label="Пауза"
            value={cards
              .filter(
                (card) =>
                  card.module === moduleType && card.status === "suspended",
              )
              .length.toString()}
          />
        </div>

        <CsvImportPanel
          isBusy={isBusy}
          importRuns={imports}
          moduleType={moduleType}
          notes={notes}
          onImport={onImport}
        />

        <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
          {filteredNotes.length === 0 ? (
            <div className="rounded-lg border border-[#263140] bg-[#151d28] p-5">
              <EmptyState
                icon={FileText}
                title={notes.length === 0 ? "Матеріалів ще немає" : "Нічого не знайдено"}
                description={
                  notes.length === 0
                    ? "Додай перший матеріал."
                    : "Зміни пошук або очисти поле."
                }
              />
            </div>
          ) : (
            filteredNotes.map((note) => {
              const noteCards = cards.filter((card) => card.noteId === note.id);
              const isSelected = note.id === selectedNote?.id;

              return (
                <button
                  key={note.id}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-[#2dd4bf] bg-[#14352f]"
                      : "border-[#263140] bg-[#0d131c] hover:bg-[#151d28]"
                  }`}
                  onClick={() => onNoteSelect(note.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {note.title}
                      </p>
                      <p className="mt-1 text-xs text-[#9aa8ba]">
                        {labelSource(note.source)} / {labelStatus(note.status)}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-[#c7d0dd]">
                      {noteCards.length}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ShellPanel>

      <NoteDetailPanel
        cards={selectedCards}
        isBusy={isBusy}
        moduleType={moduleType}
        note={selectedNote}
        onCardStatusChange={onCardStatusChange}
        onNoteContentChange={onNoteContentChange}
        onNoteStatusChange={onNoteStatusChange}
      />
    </div>
  );
}

function CsvImportPanel({
  importRuns,
  isBusy,
  moduleType,
  notes,
  onImport,
}: {
  importRuns: ImportRun[];
  isBusy: boolean;
  moduleType: ModuleType;
  notes: Note[];
  onImport: (
    rows: ClientImportCommitRow[],
    skipDuplicates: boolean,
    fileName: string | null,
  ) => Promise<ImportResultSummary>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const importableRows = preview
    ? preview.rows.filter(
        (row) =>
          row.draft &&
          (row.status === "ready" || (allowDuplicates && row.status === "duplicate")),
      )
    : [];
  const skippedByPreview =
    preview?.rows.filter((row) => row.status === "duplicate" && !allowDuplicates)
      .length ?? 0;
  const visibleIssues =
    preview?.rows
      .filter((row) => row.status !== "ready")
      .slice(0, 4) ?? [];
  const sampleColumns =
    moduleType === "english"
      ? "lemma_en, translation_uk, example_en"
      : "term, short_definition, example";

  async function readFile(file: File) {
    setLocalMessage(null);
    setAllowDuplicates(false);

    if (file.size > 1024 * 1024) {
      setPreview(null);
      setFileName(file.name);
      setLocalMessage("Файл завеликий. Краще імпортувати до 1 MB за раз.");
      return;
    }

    const text = await file.text();
    setFileName(file.name);
    setPreview(parseCsvImport(text, moduleType, notes));
  }

  function downloadTemplate() {
    const blob = new Blob([csvTemplate(moduleType)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = moduleType === "english"
      ? "memora-english-template.csv"
      : "memora-qa-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitImport() {
    if (!preview || importableRows.length === 0 || isBusy || isImporting) return;

    setIsImporting(true);
    setLocalMessage(null);

    try {
      const result = await onImport(
        preview.rows.map((row) => ({
          rowNumber: row.rowNumber,
          draft: row.draft,
          errors: row.errors,
          raw: row.raw,
        })),
        !allowDuplicates,
        fileName,
      );
      setPreview(null);
      setFileName(null);
      setAllowDuplicates(false);
      setLocalMessage(
        result.skippedDuplicates > 0
          ? `Готово: додано ${result.importedCount}, пропущено схожих записів ${result.skippedDuplicates}, помилок ${result.invalidRows}.`
          : `Готово: додано ${result.importedCount}, помилок ${result.invalidRows}.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      // Parent surfaces the server action error.
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[#263140] bg-[#0d131c] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#c7d0dd]">CSV</p>
          <p className="mt-1 text-xs text-[#6f7d90]">{sampleColumns}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
        }}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={isBusy || isImporting}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <FileText className="size-4" />
          Файл
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
          onClick={downloadTemplate}
          type="button"
        >
          <Sparkles className="size-4" />
          Шаблон
        </button>
      </div>

      {fileName ? (
        <p className="mt-2 truncate text-xs text-[#9aa8ba]">{fileName}</p>
      ) : null}

      {preview ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Готові" value={preview.summary.ready.toString()} />
            <MiniStat label="Схожі" value={preview.summary.duplicates.toString()} />
            <MiniStat label="Помилки" value={preview.summary.invalid.toString()} />
          </div>

          {preview.summary.duplicates > 0 ? (
            <label className="flex items-center gap-2 rounded-lg border border-[#3a2e18] bg-[#15110a] px-3 py-2 text-sm text-[#f7d58b]">
              <input
                className="accent-[#f2a84a]"
                type="checkbox"
                checked={allowDuplicates}
                onChange={(event) => setAllowDuplicates(event.target.checked)}
              />
              Додати навіть схожі записи
            </label>
          ) : null}

          {visibleIssues.length > 0 ? (
            <div className="space-y-2">
              {visibleIssues.map((row) => (
                <div
                  key={row.rowNumber}
                  className="rounded-lg border border-[#263140] bg-[#0b111a] p-2 text-xs leading-5 text-[#9aa8ba]"
                >
                  <p className="font-medium text-[#c7d0dd]">Рядок {row.rowNumber}</p>
                  {row.errors.length > 0 ? (
                    <p>{row.errors.join(" ")}</p>
                  ) : (
                    <p>
                      Схожий запис:{" "}
                      {row.duplicateMatches
                        .map((match) => match.note.title)
                        .join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
            disabled={importableRows.length === 0 || isBusy || isImporting}
            onClick={() => void submitImport()}
            type="button"
          >
            {isImporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Додати {importableRows.length} з CSV
          </button>

          {skippedByPreview > 0 ? (
            <p className="text-xs leading-5 text-[#9aa8ba]">
              Схожі записи буде пропущено: {skippedByPreview}.
            </p>
          ) : null}
        </div>
      ) : null}

      {localMessage ? (
        <p className="mt-3 rounded-lg border border-[#263140] bg-[#151d28] px-3 py-2 text-sm leading-6 text-[#c7d0dd]">
          {localMessage}
        </p>
      ) : null}

      <ImportHistoryPanel importRuns={importRuns} moduleType={moduleType} />
    </div>
  );
}

function ImportHistoryPanel({
  importRuns,
  moduleType,
}: {
  importRuns: ImportRun[];
  moduleType: ModuleType;
}) {
  const visibleRuns = importRuns
    .filter((run) =>
      run.rows.length === 0
        ? true
        : run.rows.some((row) => !row.module || row.module === moduleType),
    )
    .slice(0, 4);

  return (
    <div className="mt-4 border-t border-[#263140] pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#c7d0dd]">Історія</p>
        <span className="font-mono text-sm text-[#9aa8ba]">{visibleRuns.length}</span>
      </div>

      <div className="mt-3 space-y-2">
        {visibleRuns.length === 0 ? (
          <div className="rounded-lg border border-[#263140] bg-[#0b111a] p-5">
            <EmptyState
              icon={FileText}
              title="CSV ще не завантажували"
              description="Імпорти з'являться тут."
            />
          </div>
        ) : (
          visibleRuns.map((run) => {
            const stats = importRunStats(run, moduleType);
            const issueRows = run.rows
              .filter(
                (row) =>
                  (!row.module || row.module === moduleType) &&
                  row.status !== "imported",
              )
              .slice(0, 2);

            return (
              <div
                key={run.id}
                className="rounded-lg border border-[#263140] bg-[#0b111a] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#eef4ff]">
                      {run.fileName}
                    </p>
                    <p className="mt-1 text-xs text-[#9aa8ba]">
                      {formatDate(run.createdAt)} / {labelImportStatus(run.status)}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#9aa8ba]">
                    {run.rowCount}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat label="Додано" value={stats.imported.toString()} />
                  <MiniStat label="Пропущено" value={stats.skipped.toString()} />
                  <MiniStat label="Помилки" value={stats.invalid.toString()} />
                </div>
                {issueRows.length > 0 ? (
                  <div className="mt-3 space-y-1 text-xs leading-5 text-[#9aa8ba]">
                    {issueRows.map((row) => (
                      <p key={row.id}>
                        Рядок {row.rowNumber}:{" "}
                        {row.errors.length > 0
                          ? row.errors.join(" ")
                          : labelImportRowStatus(row.status)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NoteDetailPanel({
  cards,
  isBusy,
  moduleType,
  note,
  onCardStatusChange,
  onNoteContentChange,
  onNoteStatusChange,
}: {
  cards: StudyCard[];
  isBusy: boolean;
  moduleType: ModuleType;
  note: Note | null;
  onCardStatusChange: (cardId: string, status: ItemStatus) => void;
  onNoteContentChange: (
    noteId: string,
    content: NoteContentDraft,
  ) => Promise<void>;
  onNoteStatusChange: (noteId: string, status: ItemStatus) => void;
}) {
  if (!note) {
    return (
      <ShellPanel className="grid min-h-[520px] place-items-center p-6">
        <EmptyState
          icon={FileText}
          title="Матеріал не вибрано"
          description="Вибери матеріал зі списку."
        />
      </ShellPanel>
    );
  }

  return (
    <ShellPanel className="p-4 md:p-5">
      <div className="flex flex-col gap-4 border-b border-[#263140] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold">{note.title}</h2>
          <p className="mt-1 text-sm text-[#9aa8ba]">
            {moduleType === "english" ? "Англійська" : "QA"} / {labelStatus(note.status)} / {formatDate(note.createdAt)}
          </p>
        </div>
        <StatusControls
          disabled={isBusy}
          status={note.status}
          onChange={(status) => onNoteStatusChange(note.id, status)}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <NoteEditForm
          key={note.id}
          isBusy={isBusy}
          note={note}
          onSave={(content) => onNoteContentChange(note.id, content)}
        />

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Картки</h3>
              <p className="mt-1 text-sm text-[#9aa8ba]">{cards.length}</p>
            </div>
            <BookOpenCheck className="size-5 text-[#2dd4bf]" />
          </div>
          <div className="mt-4 space-y-3">
            {cards.length === 0 ? (
              <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-5">
                <EmptyState
                  icon={BookOpenCheck}
                  title="Карток для цього матеріалу немає"
                  description="Заповни поля й збережи."
                />
              </div>
            ) : (
              cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  disabled={isBusy}
                  onStatusChange={(status) =>
                    onCardStatusChange(card.id, status)
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
    </ShellPanel>
  );
}

function NoteEditForm({
  isBusy,
  note,
  onSave,
}: {
  isBusy: boolean;
  note: Note;
  onSave: (content: NoteContentDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<NoteContentDraft>(() => ({ ...note.content }));
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(note.content);

  const canSave =
    note.module === "english"
      ? textValue(draft.lemma_en) && textValue(draft.translation_uk)
      : textValue(draft.term) && textValue(draft.short_definition);

  function quickFixDraft() {
    if (note.module === "english") {
      setDraft((current) => ({
        ...current,
        lemma_en: textValue(current.lemma_en).trim(),
        translation_uk: textValue(current.translation_uk).trim(),
        part_of_speech: textValue(current.part_of_speech).trim() || "phrase",
        example_en: normalizeSentence(textValue(current.example_en)),
      }));
      return;
    }

    setDraft((current) => ({
      ...current,
      term: textValue(current.term).trim(),
      short_definition: normalizeSentence(textValue(current.short_definition)),
      example: normalizeSentence(textValue(current.example)),
    }));
  }

  async function save() {
    if (!canSave || isBusy || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Зміст</h3>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[#263140] px-3 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4]"
            disabled={isBusy || isSaving}
            onClick={quickFixDraft}
            type="button"
          >
            <Sparkles className="size-4" />
            Очистити
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#2dd4bf] px-3 py-2 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
            disabled={!canSave || !hasChanges || isBusy || isSaving}
            onClick={() => void save()}
            type="button"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Зберегти
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {note.module === "english" ? (
          <>
            <TextInput
              label="Слово або фраза"
              value={textValue(draft.lemma_en)}
              onChange={(lemma_en) =>
                setDraft((current) => ({ ...current, lemma_en }))
              }
              placeholder="bug"
            />
            <TextInput
              label="Значення"
              value={textValue(draft.translation_uk)}
              onChange={(translation_uk) =>
                setDraft((current) => ({ ...current, translation_uk }))
              }
              placeholder="дефект у програмі"
            />
            <TextInput
              label="Частина мови"
              value={textValue(draft.part_of_speech)}
              onChange={(part_of_speech) =>
                setDraft((current) => ({ ...current, part_of_speech }))
              }
              placeholder="phrase"
            />
            <TextArea
              label="Приклад"
              value={textValue(draft.example_en)}
              onChange={(example_en) =>
                setDraft((current) => ({ ...current, example_en }))
              }
              placeholder="I found a bug in the checkout flow."
            />
          </>
        ) : (
          <>
            <TextInput
              label="Термін"
              value={textValue(draft.term)}
              onChange={(term) => setDraft((current) => ({ ...current, term }))}
              placeholder="Regression testing"
            />
            <TextArea
              label="Пояснення"
              value={textValue(draft.short_definition)}
              onChange={(short_definition) =>
                setDraft((current) => ({ ...current, short_definition }))
              }
              placeholder="Перевірка, що вже робочий функціонал не зламався після змін."
            />
            <TextArea
              label="Приклад"
              value={textValue(draft.example)}
              onChange={(example) =>
                setDraft((current) => ({ ...current, example }))
              }
              placeholder="Після фікса checkout перевір payment і cart сценарії."
            />
          </>
        )}
      </div>
    </div>
  );
}

function CardRow({
  card,
  disabled,
  onStatusChange,
}: {
  card: StudyCard;
  disabled: boolean;
  onStatusChange: (status: ItemStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{labelCardType(card.type)}</Badge>
            <Badge tone={card.status === "active" ? "green" : "neutral"}>
              {labelStatus(card.status)}
            </Badge>
            <span className="font-mono text-xs text-[#9aa8ba]">
              наступний раз: {formatDate(card.schedule.due)}
            </span>
          </div>
          <div className="mt-3 space-y-3">
            <CardField label="Питання" value={card.prompt} strong />
            <CardField label="Відповідь" value={card.answer} />
            {card.explanation ? (
              <CardField label="Пояснення" value={card.explanation} />
            ) : null}
          </div>
        </div>
        <StatusControls
          compact
          disabled={disabled}
          status={card.status}
          onChange={onStatusChange}
        />
      </div>
    </div>
  );
}

function CardField({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#6f7d90]">
        {label}
      </p>
      <p
        className={`mt-1 text-sm leading-6 ${
          strong ? "font-medium text-[#eef4ff]" : "text-[#c7d0dd]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusControls({
  compact = false,
  disabled,
  status,
  onChange,
}: {
  compact?: boolean;
  disabled: boolean;
  status: ItemStatus;
  onChange: (status: ItemStatus) => void;
}) {
  const controls = [
    { status: "active" as const, label: "В навчанні", icon: PlayCircle },
    { status: "suspended" as const, label: "Пауза", icon: PauseCircle },
    { status: "archived" as const, label: "Архів", icon: Archive },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "lg:justify-end" : ""}`}>
      {controls.map((control) => {
        const Icon = control.icon;
        const isActive = status === control.status;

        return (
          <button
            key={control.status}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${
              isActive
                ? "border-[#2dd4bf] bg-[#14352f] text-[#52e0c4]"
                : "border-[#263140] text-[#9aa8ba] hover:bg-[#151d28]"
            }`}
            disabled={disabled || isActive}
            onClick={() => onChange(control.status)}
            title={control.label}
            type="button"
          >
            <Icon className="size-4" />
            <span className={compact ? "sr-only sm:not-sr-only" : ""}>
              {control.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HelpWorkspace() {
  const loopSteps: Array<{ icon: IconType; title: string; text: string }> = [
    {
      icon: Plus,
      title: "Додаєш",
      text: "слово, термін або файл CSV",
    },
    {
      icon: Brain,
      title: "Згадуєш",
      text: "пишеш відповідь без підглядання",
    },
    {
      icon: BookOpenCheck,
      title: "Звіряєш",
      text: "відкриваєш правильну відповідь",
    },
    {
      icon: Gauge,
      title: "Оцінюєш",
      text: "чесно оцінюєш, як легко згадав",
    },
    {
      icon: Clock3,
      title: "Повертаєшся пізніше",
      text: "Memora сама підкаже наступний день",
    },
  ];

  const effectiveness = [
    {
      icon: Brain,
      title: "Активне пригадування",
      text: "Ти не перечитуєш готову відповідь, а дістаєш її з пам'яті. Саме це тренує згадування у співбесіді, роботі й живій розмові.",
    },
    {
      icon: Clock3,
      title: "Інтервали повторення",
      text: "Картки повертаються не щогодини і не випадково, а тоді, коли пам'ять уже трохи слабшає. Так менше зубріння і більше користі.",
    },
    {
      icon: Gauge,
      title: "Розумний розклад",
      text: "Після кожної оцінки Memora перераховує, коли краще повернути картку. Те, що згадалося легко, з'явиться пізніше. Те, що забулося, повернеться швидше.",
    },
    {
      icon: Languages,
      title: "Пояснення українською",
      text: "Англійські слова й QA-терміни можуть залишатися англійською, але сенс пояснюється українською. Так ти вчиш значення, а не просто набір символів.",
    },
  ];

  const productBlocks: Array<{
    icon: IconType;
    title: string;
    role: string;
    use: string;
  }> = [
    {
      icon: Target,
      title: "Практика",
      role: "Поточна черга.",
      use: "Починай звідси. Тут зібрані картки, які варто пройти зараз: спершу повторення, потім нові.",
    },
    {
      icon: Languages,
      title: "Англійські слова",
      role: "Слова, фрази, переклади й приклади.",
      use: "Додавай англійське слово або фразу, українське значення і приклад. Memora зробить картки на переклад, розуміння й контекст.",
    },
    {
      icon: Code2,
      title: "QA та тестування",
      role: "Терміни, пояснення і практичні ситуації.",
      use: "Записуй терміни з QA або тестування простими українськими поясненнями. Memora зробить картки на визначення, зворотне пригадування й ситуації зі співбесід.",
    },
    {
      icon: BarChart3,
      title: "Прогрес",
      role: "Огляд навчання.",
      use: "Дивись, скільки вже повторено, які теми просідають, що добре закріпилось і де варто відредагувати картки.",
    },
    {
      icon: UserCircle,
      title: "Профіль",
      role: "Профіль і безпека.",
      use: "Налаштовуй часовий пояс, рівень англійської, навчальну ціль і пароль. Тут немає навчальної черги, тільки особисті параметри.",
    },
    {
      icon: FileText,
      title: "Як користуватись",
      role: "Пояснення всього сервісу.",
      use: "Повертайся сюди, якщо забув, що означає оцінка, розділ, імпорт, статус картки або щоденна логіка повторення.",
    },
  ];

  const routine = [
    "Відкрий «Практика» і пройди підготовлену чергу.",
    "Прочитай питання і спробуй відповісти з пам'яті. Навіть короткий неповний варіант краще, ніж одразу дивитися відповідь.",
    "Натисни «Перевірити відповідь», порівняй із тим, що написав, і оціни чесно.",
    "Якщо бачиш потрібне слово або термін з тестування, додай його через швидке додавання або CSV.",
    "Раз на кілька днів відкрий «Прогрес», подивись на слабкі місця і відредагуй картки, які сформульовані нечітко.",
  ];

  const ratings = [
    {
      label: "Знову",
      tone: "border-[#6f2b2b] bg-[#2a1215] text-[#ffb4aa]",
      text: "Не згадав або згадав неправильно. Картка повернеться швидко.",
    },
    {
      label: "Важко",
      tone: "border-[#76551f] bg-[#2d2110] text-[#ffd38a]",
      text: "Згадав із великою напругою. Є тільки в розширених кнопках.",
    },
    {
      label: "Добре",
      tone: "border-[#256b60] bg-[#102b27] text-[#8df3dd]",
      text: "Згадав достатньо впевнено. Це основна нормальна оцінка.",
    },
    {
      label: "Легко",
      tone: "border-[#48408c] bg-[#211f44] text-[#b8b0ff]",
      text: "Відповідь прийшла майже миттєво. Є тільки в розширених кнопках.",
    },
  ];

  return (
    <div className="space-y-5">
      <ShellPanel className="overflow-hidden p-4 md:p-5">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] xl:items-center">
          <div>
            <h2 className="text-2xl font-semibold leading-tight md:text-3xl">
              Memora допомагає не просто читати матеріал, а тренувати реальне
              пригадування.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#9aa8ba]">
              У сервісі є дві навчальні бази: англійські слова та QA і тестування.
              Кожен доданий матеріал перетворюється на кілька карток. Ти
              відповідаєш з пам&apos;яті, перевіряєш себе, ставиш оцінку, а Memora
              планує наступне повторення.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Головна дія" value="згадати" />
              <MiniStat label="Ритм" value="щодня" />
              <MiniStat label="Мета" value="довго" />
            </div>
          </div>

          <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#9aa8ba]">
                  Механіка навчання
                </p>
                <h3 className="text-lg font-semibold">Цикл однієї картки</h3>
              </div>
              <Activity className="size-5 text-[#2dd4bf]" />
            </div>
            <div className="memora-flow mt-5">
              {loopSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="memora-flow-step">
                    <div className="grid size-11 place-items-center rounded-lg border border-[#2dd4bf]/40 bg-[#14352f] text-[#52e0c4]">
                      <Icon className="size-5" />
                    </div>
                    <span className="mt-3 font-mono text-xs text-[#6f7d90]">
                      0{index + 1}
                    </span>
                    <p className="mt-1 text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#9aa8ba]">
                      {step.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ShellPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ShellPanel className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#9aa8ba]">
                Чому це працює
              </p>
              <h2 className="text-lg font-semibold">
                Ефективність не в кількості карток, а в якості пригадування
              </h2>
            </div>
            <Brain className="size-5 text-[#2dd4bf]" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {effectiveness.map((item) => (
              <HelpCard key={item.title} icon={item.icon} title={item.title}>
                {item.text}
              </HelpCard>
            ))}
          </div>
        </ShellPanel>

        <ShellPanel className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#9aa8ba]">
                Щоденний сценарій
              </p>
              <h2 className="text-lg font-semibold">Як користуватись</h2>
            </div>
            <Target className="size-5 text-[#2dd4bf]" />
          </div>
          <ol className="mt-4 space-y-3">
            {routine.map((item, index) => (
              <li key={item} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#14352f] font-mono text-xs text-[#52e0c4]">
                  {index + 1}
                </span>
                <span className="text-sm leading-6 text-[#c7d0dd]">{item}</span>
              </li>
            ))}
          </ol>
        </ShellPanel>
      </div>

      <ShellPanel className="p-4 md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-[#9aa8ba]">Розділи</p>
            <h2 className="text-lg font-semibold">Що де знаходиться</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#9aa8ba]">
            Якщо коротко: «Практика» для навчання, «Англійські слова» і
            «QA та тестування» для матеріалів, «Прогрес» для перевірки слабких
            місць, «Профіль» для особистих налаштувань.
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {productBlocks.map((block) => (
            <HelpBlock key={block.title} {...block} />
          ))}
        </div>
      </ShellPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <ShellPanel className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#9aa8ba]">
                Оцінювання
              </p>
              <h2 className="text-lg font-semibold">
                Як обирати кнопку після відповіді
              </h2>
            </div>
            <Gauge className="size-5 text-[#2dd4bf]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ratings.map((rating) => (
              <div
                key={rating.label}
                className={`rounded-lg border p-4 ${rating.tone}`}
              >
                <p className="font-semibold">{rating.label}</p>
                <p className="mt-2 text-sm leading-6">{rating.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-[#263140] bg-[#0d131c] p-3 text-sm leading-6 text-[#9aa8ba]">
            Правило просте: оцінюй не “наскільки я хочу це знати”, а “як легко я
            реально згадав зараз”. Чесність важливіша за красиву статистику.
          </p>
        </ShellPanel>

        <ShellPanel className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#9aa8ba]">
                Матеріали й дані
              </p>
              <h2 className="text-lg font-semibold">
                Додавання, імпорт, ремонт і резервні копії
              </h2>
            </div>
            <FileText className="size-5 text-[#2dd4bf]" />
          </div>
          <div className="mt-4 space-y-3">
            <HelpLine
              icon={Plus}
              title="Швидке додавання"
              text="Підходить для одного слова, фрази або терміна, який щойно зустрівся в роботі, курсі чи співбесіді."
            />
            <HelpLine
              icon={BookOpenCheck}
              title="Картки з матеріалу"
              text="З одного запису Memora робить кілька карток: для англійської це переклад, розуміння і контекст; для QA - визначення, зворотне пригадування і практична ситуація."
            />
            <HelpLine
              icon={FileText}
              title="Імпорт з CSV"
              text="Підходить для списку слів або термінів. Спочатку Memora показує попередній перегляд, схожі записи й помилки, а вже потім додає картки."
            />
            <HelpLine
              icon={Archive}
              title="Призупинити або архівувати"
              text="Якщо картка погано сформульована або вже не потрібна, її краще прибрати з черги, а не мучити себе повтореннями."
            />
            <HelpLine
              icon={Download}
              title="Резервна копія"
              text="У «Прогресі» можна завантажити повну резервну копію JSON і окремі CSV для англійських слів та QA."
            />
          </div>
        </ShellPanel>
      </div>

      <ShellPanel className="p-4 md:p-5">
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="text-sm font-medium text-[#9aa8ba]">
              Швидка пам&apos;ятка
            </p>
            <h2 className="text-lg font-semibold">Як зрозуміти, що все йде добре</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MiniStat label="Черга зменшується" value="так" />
            <MiniStat label="Помилки показують слабкі місця" value="видно" />
            <MiniStat label="Нові картки не витісняють повторення" value="баланс" />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <HelpCard icon={Check} title="Нормальний день">
            Ти зробив доступну чергу, додав 0-3 справді потрібні матеріали і не
            намагався занести в систему весь список “на колись” за один вечір.
          </HelpCard>
          <HelpCard icon={AlertCircle} title="Коли треба втрутитись">
            Якщо одна картка постійно падає, проблема часто не в тобі, а в
            формулюванні. Відредагуй матеріал, додай простіший приклад або
            призупини зайву картку.
          </HelpCard>
        </div>
      </ShellPanel>
    </div>
  );
}

function HelpCard({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: IconType;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
          <Icon className="size-4" />
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#9aa8ba]">{children}</p>
    </div>
  );
}

function HelpBlock({
  icon: Icon,
  role,
  title,
  use,
}: {
  icon: IconType;
  role: string;
  title: string;
  use: string;
}) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#202938] text-[#eef4ff]">
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-[#52e0c4]">
            {role}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#9aa8ba]">{use}</p>
    </div>
  );
}

function HelpLine({
  icon: Icon,
  text,
  title,
}: {
  icon: IconType;
  text: string;
  title: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-[#263140] bg-[#0d131c] p-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#14352f] text-[#52e0c4]">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#9aa8ba]">{text}</p>
      </div>
    </div>
  );
}

function AccountWorkspace({
  isBusy,
  isPasswordRecovery,
  profile,
  state,
  user,
  onPasswordReset,
  onPasswordUpdate,
  onProfileSave,
  onSettingsChange,
}: {
  isBusy: boolean;
  isPasswordRecovery: boolean;
  profile: UserProfile | null;
  state: MemoraState;
  user: User | null;
  onPasswordReset: (email: string) => Promise<void>;
  onPasswordUpdate: (password: string) => Promise<void>;
  onProfileSave: (draft: UserProfileDraft) => Promise<void>;
  onSettingsChange: (settings: AppSettings) => void;
}) {
  const [draft, setDraft] = useState<UserProfileDraft>(() =>
    profileToDraft(profile),
  );
  const [resetEmail, setResetEmail] = useState(user?.email ?? profile?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);

    try {
      await onProfileSave(draft);
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <ShellPanel className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Профіль</h2>
            </div>
            <Globe2 className="size-5 text-[#2dd4bf]" />
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
                  Мова інтерфейсу
                </span>
                <select
                  className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                  value={draft.locale}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      locale: event.target.value,
                    }))
                  }
                >
                  {localeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-[#c7d0dd]">
                  Часовий пояс
                </span>
                <select
                  className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                  value={draft.timezone}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                >
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

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

              <label className="block">
                <span className="text-sm font-medium text-[#c7d0dd]">
                  Хвилин на день
                </span>
                <input
                  className="mt-1 h-11 w-full rounded-lg border border-[#263140] bg-[#0b111a] px-3 text-sm text-[#eef4ff] outline-none transition placeholder:text-[#6f7d90] focus:border-[#2dd4bf] focus:ring-4 focus:ring-[#2dd4bf]/20"
                  max={180}
                  min={5}
                  type="number"
                  value={draft.dailyMinutes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dailyMinutes: Number(event.target.value),
                    }))
                  }
                />
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

            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[#2dd4bf] px-4 py-3 text-sm font-semibold text-[#071018] transition hover:bg-[#5eead4] disabled:cursor-not-allowed disabled:bg-[#344052] disabled:text-[#8d9aab]"
              disabled={isBusy}
              type="submit"
            >
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Зберегти профіль
            </button>
          </form>
        </ShellPanel>

        <SettingsPanel
          state={state}
          onChange={(nextState) => onSettingsChange(nextState.settings)}
        />
      </div>

      <ShellPanel className="p-4 md:p-5">
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
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#263140] px-4 py-2 text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4] disabled:cursor-not-allowed disabled:opacity-60"
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

function ReadOnlyField({
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

function AnalyticsWorkspace({
  isBusy,
  onRestoreBackup,
  state,
  summary,
}: {
  isBusy: boolean;
  onRestoreBackup: (backup: BackupDocument) => Promise<void>;
  state: MemoraState;
  summary: QueueSummary;
}) {
  const recentLogs = state.reviewLogs.slice(-8).reverse();

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <AnalyticsPanel state={state} summary={summary} />
      <ShellPanel className="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Історія</h2>
          </div>
          <Activity className="size-5 text-[#2dd4bf]" />
        </div>
        <div className="mt-4 space-y-3">
          {recentLogs.length === 0 ? (
            <div className="rounded-lg border border-[#263140] bg-[#151d28] p-5">
              <EmptyState
                icon={Activity}
                title="Повторень ще немає"
                description="Оцінені картки з'являться тут."
              />
            </div>
          ) : (
            recentLogs.map((log) => {
              const card = state.cards.find((item) => item.id === log.cardId);

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-[#263140] bg-[#0d131c] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={log.module === "english" ? "green" : "violet"}>
                      {log.rating}
                    </Badge>
                    <span className="text-xs text-[#9aa8ba]">
                      {formatDate(log.reviewedAt)}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-sm font-medium">
                    {card?.prompt ?? "Повторена картка"}
                  </p>
                  <p className="mt-1 text-xs text-[#9aa8ba]">
                    {log.wasCorrect ? "Згадано" : "Потрібно повторити"} /{" "}
                    {Math.round(log.elapsedMs / 1000)} сек
                  </p>
                </div>
              );
            })
          )}
        </div>
      </ShellPanel>
      <div className="xl:col-span-2">
        <DeckPanel state={state} />
      </div>
      <div className="xl:col-span-2">
        <BackupPanel
          isBusy={isBusy}
          state={state}
          onRestoreBackup={onRestoreBackup}
        />
      </div>
    </div>
  );
}

function BackupPanel({
  isBusy,
  onRestoreBackup,
  state,
}: {
  isBusy: boolean;
  onRestoreBackup: (backup: BackupDocument) => Promise<void>;
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
  return (
    <ShellPanel className="p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Дані</h2>
        </div>
        <span className="font-mono text-sm text-[#9aa8ba]">
          {state.notes.length}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
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
      <div className="mt-4 rounded-lg border border-[#263140] bg-[#0d131c] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#eef4ff]">
              Відновлення
            </p>
          </div>
          <input
            ref={fileInputRef}
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleBackupFileChange(event)}
            type="file"
          />
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#314055] px-4 text-sm font-semibold text-[#dce7f5] transition hover:border-[#2dd4bf] hover:bg-[#101a25] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload className="size-4" />
            Обрати JSON-файл
          </button>
        </div>

        {restoreError ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#ef4444]/30 bg-[#2b1216] p-3 text-sm leading-6 text-[#fecaca]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{restoreError}</span>
          </div>
        ) : null}

        {backupPreview ? (
          <div className="mt-4 rounded-lg border border-[#314055] bg-[#0b111a] p-4">
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
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2dd4bf] px-4 text-sm font-semibold text-[#03110f] transition hover:bg-[#67e8d7] disabled:cursor-not-allowed disabled:bg-[#3a4b60] disabled:text-[#91a0b3]"
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
        ) : null}
      </div>
    </ShellPanel>
  );
}

function PreviewMetric({
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

function ExportButton({
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

function DeckPanel({ state }: { state: MemoraState }) {
  const activeCards = state.cards.filter((card) => card.status === "active");
  const englishCards = activeCards.filter((card) => card.module === "english");
  const qaCards = activeCards.filter((card) => card.module === "qa");
  const sourceCounts = {
    seed: state.notes.filter((note) => note.source === "seed").length,
    user: state.notes.filter((note) => note.source === "user").length,
    imported: state.notes.filter((note) => note.source === "imported").length,
  };

  return (
    <ShellPanel className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Матеріали</h2>
        </div>
        <BookOpenCheck className="size-5 text-[#2dd4bf]" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DeckStat
          title="Англійські слова"
          value={englishCards.length}
          tone="green"
        />
        <DeckStat
          title="QA та тестування"
          value={qaCards.length}
          tone="violet"
        />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Приклади Memora" value={sourceCounts.seed.toString()} />
        <MiniStat label="Додані вручну" value={sourceCounts.user.toString()} />
        <MiniStat label="Імпорт" value={sourceCounts.imported.toString()} />
      </div>
      <div className="mt-4 divide-y divide-[#263140]">
        {state.notes.length === 0 ? (
          <div className="py-4">
            <EmptyState
              icon={BookOpenCheck}
              title="Матеріалів ще немає"
              description="Додай перший матеріал."
            />
          </div>
        ) : (
          state.notes.slice(-5).map((note) => (
            <div key={note.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{note.title}</p>
                <p className="text-xs text-[#9aa8ba]">
                  {labelSource(note.source)} / {labelStatus(note.status)}
                </p>
              </div>
              <Badge tone={note.module === "english" ? "green" : "violet"}>
                {note.module === "english" ? "Англ." : "QA"}
              </Badge>
            </div>
          ))
        )}
      </div>
    </ShellPanel>
  );
}

function AnalyticsPanel({
  state,
  summary,
}: {
  state: MemoraState;
  summary: QueueSummary;
}) {
  const topics = topicStats(state);

  return (
    <ShellPanel className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Повторення</h2>
        </div>
        <Sparkles className="size-5 text-[#f2a84a]" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Повторень" value={state.reviewLogs.length.toString()} />
        <MiniStat label="Невдалих спроб" value={summary.lapses.toString()} />
        <MiniStat label="Проблемних карток" value={summary.leeches.toString()} />
      </div>
      <div className="mt-5 space-y-3">
        {topics.length === 0 ? (
          <p className="rounded-lg border border-[#263140] bg-[#151d28] p-4 text-sm leading-6 text-[#9aa8ba]">
            Точність за темами з’явиться після перших повторень.
          </p>
        ) : (
          topics.map((topic) => (
            <div key={topic.topic}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{topic.topic}</span>
                <span className="font-mono text-[#9aa8ba]">
                  {formatPercent(topic.accuracy)}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#273142]">
                <div
                  className="h-2 rounded-full bg-[#2dd4bf]"
                  style={{ width: `${Math.round((topic.accuracy ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </ShellPanel>
  );
}

function TextInput({
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

function TextArea({
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

function Badge({
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

function DeckStat({
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#263140] bg-[#0d131c] p-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#9aa8ba]">{label}</p>
    </div>
  );
}

function labelCardType(type: StudyCard["type"]) {
  const labels: Record<StudyCard["type"], string> = {
    productive_translation: "активний переклад",
    receptive_translation: "розуміння слова",
    cloze_context: "контекст",
    collocation_recall: "словосполучення",
    term_definition: "пояснити термін",
    definition_term: "згадати термін",
    contrast: "порівняння",
    scenario: "сценарій",
    code_tool: "інструмент/код",
  };

  return labels[type];
}

function labelStatus(status: ItemStatus) {
  const labels: Record<ItemStatus, string> = {
    active: "в навчанні",
    suspended: "на паузі",
    archived: "в архіві",
  };

  return labels[status];
}

function labelSource(source: Note["source"]) {
  const labels: Record<Note["source"], string> = {
    seed: "приклад від Memora",
    user: "додано вручну",
    imported: "з CSV",
  };

  return labels[source];
}

function labelImportStatus(status: ImportRun["status"]) {
  const labels: Record<ImportRun["status"], string> = {
    uploaded: "завантажено",
    validating: "перевіряється",
    ready: "готовий",
    processing: "обробляється",
    completed: "завершено",
    failed: "помилка",
  };

  return labels[status];
}

function labelImportRowStatus(status: ImportRun["rows"][number]["status"]) {
  const labels: Record<ImportRun["rows"][number]["status"], string> = {
    valid: "валідний",
    invalid: "помилка",
    imported: "додано",
    skipped: "пропущено",
  };

  return labels[status];
}

function importRunStats(run: ImportRun, moduleType: ModuleType) {
  const rows = run.rows.filter((row) => !row.module || row.module === moduleType);

  return {
    imported: rows.filter((row) => row.status === "imported").length,
    skipped: rows.filter((row) => row.status === "skipped").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
  };
}

function labelDuplicateField(field: string) {
  const labels: Record<string, string> = {
    title: "назва",
    "English phrase": "англійська фраза",
    "QA term": "термін з тестування",
  };

  return labels[field] ?? field;
}

function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function noteMatchesQuery(note: Note, query: string) {
  const values = Object.values(note.content)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    note.title.toLowerCase().includes(query) ||
    note.tags.join(" ").toLowerCase().includes(query) ||
    values.includes(query)
  );
}

function statusRank(status: ItemStatus) {
  const ranks: Record<ItemStatus, number> = {
    active: 0,
    suspended: 1,
    archived: 2,
  };

  return ranks[status];
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeSentence(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}
