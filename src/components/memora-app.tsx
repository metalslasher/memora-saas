"use client";

import type { User } from "@supabase/supabase-js";
import { Clock3, Flame, Gauge, ListChecks, LogOut, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEnglishNoteAction,
  addQaNoteAction,
  clearMaterialsAction,
  deleteNoteAction,
  importEnglishNotesAction,
  importQaNotesAction,
  loadMemoraStateAction,
  loadProfileAction,
  resetLearningStatsAction,
  reviewCardAction,
  restoreBackupAction,
  suspendCardAction,
  updateNoteContentAction,
  updateNoteStatusAction,
  updateProfileAction,
  updateSettingsAction,
} from "@/app/actions";
import type {
  EnglishDraft,
  QaDraft,
} from "@/lib/memora/card-generator";
import type { BackupDocument } from "@/lib/memora/backup";
import { getDueQueue, summarizeState } from "@/lib/memora/store";
import { buildStreakStats } from "@/lib/memora/streak";
import type { NoteContentDraft } from "@/lib/memora/remote-store";
import type {
  AppSettings,
  MemoraState,
  ModuleType,
  ReviewRating,
  UserProfile,
  UserProfileDraft,
} from "@/lib/memora/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AccountWorkspace } from "./memora/account-workspace";
import { AnalyticsWorkspace } from "./memora/analytics-workspace";
import { AuthPanel, LoadingScreen } from "./memora/auth";
import { ContentManager } from "./memora/content-manager";
import { HelpWorkspace } from "./memora/help-workspace";
import {
  BrandLockup,
  CollapsedStreakButton,
  MobileTopBar,
  NavigationList,
  StudyStreakWidget,
} from "./memora/layout";
import { StudyPanel } from "./memora/practice";
import { Metric, ModeSelector, ShellPanel, StatusBanner } from "./memora/shared-ui";
import type {
  AppView,
  ClientImportCommitRow,
  ImportResultSummary,
  ItemStatus,
} from "./memora/types";
import { navigationItems } from "./memora/types";
import {
  formatError,
  formatPercent,
  getPracticeQueueLength,
  labelStatus,
  unwrapActionState,
  unwrapProfile,
} from "./memora/utils";

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [practiceSessionTotal, setPracticeSessionTotal] = useState(0);
  const [optimisticCompletedCardIds, setOptimisticCompletedCardIds] = useState(
    () => new Set<string>(),
  );
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const loadingUserIdRef = useRef<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const isSavingSettingsRef = useRef(false);
  const pendingSettingsRef = useRef<AppSettings | null>(null);

  const resetPracticeUi = useCallback(() => {
    setActiveCardId(null);
    setResponseText("");
    setIsRevealed(false);
    setStartedAt(Date.now());
  }, []);

  const resetPracticeSession = useCallback(
    (nextState: MemoraState | null) => {
      resetPracticeUi();
      setPracticeSessionTotal(
        nextState ? getPracticeQueueLength(nextState) : 0,
      );
      setOptimisticCompletedCardIds(new Set());
    },
    [resetPracticeUi],
  );

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
        resetPracticeSession(nextState);
        loadedUserIdRef.current = nextUser.id;
      } catch (error) {
        setErrorMessage(formatError(error));
      } finally {
        if (loadingUserIdRef.current === nextUser.id) {
          loadingUserIdRef.current = null;
        }
      }
    },
    [resetPracticeSession],
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
        resetPracticeSession(null);
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
        loadingUserIdRef.current = null;
        loadedUserIdRef.current = null;
        resetPracticeSession(null);
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
  }, [loadUserData, resetPracticeSession, supabase]);

  const queue = useMemo(
    () =>
      state
        ? getDueQueue(state, state.settings.studyMode).filter(
            (card) => !optimisticCompletedCardIds.has(card.id),
          )
        : [],
    [optimisticCompletedCardIds, state],
  );

  const summary = useMemo(() => (state ? summarizeState(state) : null), [state]);
  const streakStats = useMemo(
    () => buildStreakStats(state?.reviewLogs ?? []),
    [state],
  );

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
    contentNotes.find((note) => note.id === selectedNoteId) ?? null;
  const currentViewLabel =
    navigationItems.find((item) => item.view === activeView)?.label ?? "Memora";

  const navigateToView = useCallback((view: AppView) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
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
      resetPracticeSession(null);
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
    const isModeChange = settings.studyMode !== previousState.settings.studyMode;
    pendingSettingsRef.current = settings;
    setState(nextState);
    setErrorMessage(null);
    if (isModeChange) resetPracticeSession(nextState);

    if (isSavingSettingsRef.current) return;

    isSavingSettingsRef.current = true;

    try {
      while (pendingSettingsRef.current) {
        const settingsToSave = pendingSettingsRef.current;
        pendingSettingsRef.current = null;
        const updatedState = unwrapActionState(
          await updateSettingsAction(settingsToSave),
        );

        if (!pendingSettingsRef.current) {
          setState(updatedState);
          if (settingsToSave.studyMode !== previousState.settings.studyMode) {
            resetPracticeSession(updatedState);
          }
        }
      }
    } catch (error) {
      pendingSettingsRef.current = null;
      setState(previousState);
      if (isModeChange) resetPracticeSession(previousState);
      setErrorMessage(formatError(error));
    } finally {
      isSavingSettingsRef.current = false;
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
    const reviewedCardId = activeCard.id;
    const reviewedResponse = responseText.trim();
    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setOptimisticCompletedCardIds((current) => {
      const next = new Set(current);
      next.add(reviewedCardId);
      return next;
    });
    setActiveCardId(null);
    setIsRevealed(false);
    setResponseText("");
    setStartedAt(Date.now());

    try {
      const nextState = unwrapActionState(
        await reviewCardAction({
          cardId: reviewedCardId,
          rating,
          responseText: reviewedResponse,
          elapsedMs,
        }),
      );
      setState(nextState);
      resetPracticeUi();
      setOptimisticCompletedCardIds((current) => {
        const next = new Set(current);
        next.delete(reviewedCardId);
        return next;
      });
    } catch (error) {
      setOptimisticCompletedCardIds((current) => {
        const next = new Set(current);
        next.delete(reviewedCardId);
        return next;
      });
      setActiveCardId(reviewedCardId);
      setResponseText(reviewedResponse);
      setIsRevealed(true);
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

  async function handleNoteDelete(noteId: string) {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(await deleteNoteAction(noteId));
      setState(nextState);
      setSelectedNoteId(null);
      resetPracticeSession(nextState);
      setStatusMessage("Матеріал видалено.");
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
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
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(await addEnglishNoteAction(draft));
      setState(nextState);
      setStatusMessage("Додано англійський матеріал та 2 картки.");
      resetPracticeSession(nextState);
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
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(await addQaNoteAction(draft));
      setState(nextState);
      setStatusMessage("Додано матеріал з тестування та 2 картки.");
      resetPracticeSession(nextState);
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
      resetPracticeSession(result.state);
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
      resetPracticeSession(nextState);
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

  async function handleClearMaterials() {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(await clearMaterialsAction());
      setState(nextState);
      setSelectedNoteId(null);
      resetPracticeSession(nextState);
      setStatusMessage("Усі матеріали видалено.");
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleResetLearningStats() {
    if (!state || isMutating) return;

    setIsMutating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const nextState = unwrapActionState(await resetLearningStatsAction());
      setState(nextState);
      resetPracticeSession(nextState);
      setStatusMessage("Статистику навчання обнулено.");
    } catch (error) {
      setErrorMessage(formatError(error));
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  if (authStatus === "loading") {
    return <LoadingScreen />;
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
    return <LoadingScreen />;
  }

  return (
    <main className="min-h-screen bg-[#070a0f] text-[#eef4ff]">
      <MobileTopBar
        activeView={activeView}
        currentViewLabel={currentViewLabel}
        isBusy={isMutating}
        isOpen={isMobileMenuOpen}
        streakStats={streakStats}
        userEmail={user?.email}
        onNavigate={navigateToView}
        onSignOut={() => {
          setIsMobileMenuOpen(false);
          void handleSignOut();
        }}
        onToggle={() => setIsMobileMenuOpen((value) => !value)}
      />

      <div className="mx-auto flex w-full max-w-[1440px] gap-4 px-3 pb-4 pt-3 md:px-5 lg:gap-5 lg:px-6 lg:py-4">
        <aside
          className={`hidden shrink-0 transition-[width] duration-300 lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)] ${
            isSidebarCollapsed ? "lg:w-20" : "lg:w-72"
          }`}
        >
          <ShellPanel
            className={`flex h-full flex-col justify-between ${
              isSidebarCollapsed ? "p-3" : "p-4"
            }`}
          >
            <div>
              <div
                className={`flex items-center ${
                  isSidebarCollapsed ? "justify-center" : "justify-start"
                }`}
              >
                <BrandLockup
                  isCollapsed={isSidebarCollapsed}
                  onToggleSidebar={() =>
                    setIsSidebarCollapsed((value) => !value)
                  }
                />
              </div>
              <NavigationList
                activeView={activeView}
                className={isSidebarCollapsed ? "mt-6" : "mt-7"}
                isCollapsed={isSidebarCollapsed}
                onNavigate={navigateToView}
              />
            </div>

            <div className="mt-6 space-y-3">
              {isSidebarCollapsed ? (
                <CollapsedStreakButton stats={streakStats} />
              ) : (
                <StudyStreakWidget stats={streakStats} />
              )}
              <button
                className={`flex w-full items-center justify-center gap-2 rounded-lg border border-[#263140] text-sm font-medium text-[#c7d0dd] transition hover:border-[#2dd4bf] hover:text-[#52e0c4] ${
                  isSidebarCollapsed ? "h-11 px-0" : "px-3 py-2"
                }`}
                title={user?.email ?? "Вийти"}
                disabled={isMutating}
                onClick={() => void handleSignOut()}
              >
                <LogOut className="size-4" />
                <span className={isSidebarCollapsed ? "sr-only" : ""}>
                  Вийти
                </span>
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
            <div className="space-y-4 md:space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
                  className="col-span-2 md:col-span-1"
                />
              </div>

              <ModeSelector
                value={state.settings.studyMode}
                onChange={(studyMode) => {
                  void handleSettingsChange({
                    ...state.settings,
                    studyMode,
                  });
                }}
              />

              <StudyPanel
                card={activeCard}
                queueLength={queue.length}
                sessionTotal={practiceSessionTotal}
                responseText={responseText}
                isRevealed={isRevealed}
                isBusy={isMutating}
                reviewButtons={state.settings.reviewButtons}
                onResponseChange={setResponseText}
                onReveal={() => setIsRevealed(true)}
                onHideAnswer={() => setIsRevealed(false)}
                onReview={(rating) => void submitReview(rating)}
                onSuspend={(cardId) => void handleSuspend(cardId)}
              />
            </div>
          ) : activeView === "account" ? (
            <AccountWorkspace
              key={`${profile?.updatedAt ?? user?.id ?? "account"}:${state.settings.dailyNewLimit}:${state.settings.reviewButtons}`}
              isBusy={isMutating}
              isPasswordRecovery={isPasswordRecovery}
              profile={profile}
              state={state}
              user={user}
              onPasswordReset={handlePasswordReset}
              onPasswordUpdate={handlePasswordUpdate}
              onProfileSave={handleProfileSave}
              onRestoreBackup={handleRestoreBackup}
              onSettingsChange={handleSettingsChange}
              onClearMaterials={handleClearMaterials}
              onResetLearningStats={handleResetLearningStats}
            />
          ) : activeView === "help" ? (
            <HelpWorkspace />
          ) : activeView === "analytics" ? (
            <AnalyticsWorkspace
              onOpenNote={(noteId) => {
                const note = state.notes.find((item) => item.id === noteId);
                if (!note) return;

                setSelectedNoteId(noteId);
                setActiveView(note.module);
                setIsMobileMenuOpen(false);
              }}
              state={state}
              summary={summary}
            />
          ) : contentModule ? (
            <ContentManager
              cards={state.cards}
              imports={state.imports}
              isBusy={isMutating}
              moduleType={contentModule}
              notes={contentNotes}
              selectedNote={selectedNote}
              onAddEnglish={handleAddEnglish}
              onAddQa={handleAddQa}
              onNoteContentChange={handleNoteContentChange}
              onNoteDelete={handleNoteDelete}
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
