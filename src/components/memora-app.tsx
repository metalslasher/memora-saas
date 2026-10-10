"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEnglishNoteAction,
  addQaNoteAction,
  clearMaterialsAction,
  deleteNoteAction,
  gradeCardAction,
  importEnglishNotesAction,
  importQaNotesAction,
  loadMemoraStateAction,
  loadProfileAction,
  pauseCardAction,
  resetLearningStatsAction,
  restoreBackupAction,
  undoReviewAction,
  updateCardStatusAction,
  updateNoteContentAction,
  updateNoteStatusAction,
  updateProfileAction,
  updateSettingsAction,
} from "@/app/actions";
import type { EnglishDraft, QaDraft } from "@/lib/memora/card-generator";
import type { BackupDocument } from "@/lib/memora/backup";
import { scheduleReview } from "@/lib/memora/scheduler";
import {
  countHeldBackNew,
  getDueQueue,
  nextDueAt,
  summarizeState,
} from "@/lib/memora/store";
import { buildStreakStats } from "@/lib/memora/streak";
import type { NoteContentDraft } from "@/lib/memora/remote-store";
import type {
  AppSettings,
  MemoraState,
  ModuleType,
  ReviewLog,
  ReviewRating,
  StoredSchedule,
  StudyMode,
  UserProfile,
  UserProfileDraft,
} from "@/lib/memora/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AccountWorkspace } from "./memora/account-workspace";
import { AnalyticsWorkspace } from "./memora/analytics-workspace";
import { LoadingScreen } from "./memora/auth";
import { ContentManager } from "./memora/content-manager";
import { HelpWorkspace } from "./memora/help-workspace";
import { LandingPage } from "./memora/landing-page";
import { MobileTabBar, MobileTopBar, Sidebar } from "./memora/layout";
import { PracticeWorkspace, type PracticeSession } from "./memora/practice";
import { StatusBanner, Toast, type ToastMessage } from "./memora/shared-ui";
import type {
  AppView,
  ClientImportCommitRow,
  ImportResultSummary,
  ItemStatus,
} from "./memora/types";
import { navigationItems } from "./memora/types";
import {
  formatError,
  labelStatus,
  unwrapActionState,
  unwrapProfile,
} from "./memora/utils";

const studyModes: StudyMode[] = ["daily", "english-productive", "qa-interview"];
const SIDEBAR_KEY = "memora:sidebar-collapsed";

type LastReview = {
  cardId: string;
  previousSchedule: StoredSchedule;
  tempLogId: string;
  wasCorrect: boolean;
  serverLogId: Promise<string | null>;
};

function readSidebarPreference() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    // Storage can be unavailable (private mode); the default is fine.
    return false;
  }
}

function newSession(): PracticeSession {
  return { reviewed: 0, correct: 0, startedAt: Date.now() };
}

export function MemoraApp({
  initialUser = null,
}: {
  initialUser?: User | null;
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [authStatus, setAuthStatus] = useState<
    "loading" | "signed-out" | "signed-in"
  >(initialUser ? "signed-in" : "signed-out");
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [state, setState] = useState<MemoraState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("today");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarPreference);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [session, setSession] = useState<PracticeSession>(newSession);
  const [extraNew, setExtraNew] = useState(0);
  const [lastReview, setLastReview] = useState<LastReview | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [isMutating, setIsMutating] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const loadingUserIdRef = useRef<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const isSavingSettingsRef = useRef(false);
  const pendingSettingsRef = useRef<AppSettings | null>(null);
  const reviewChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const showToast = useCallback(
    (tone: ToastMessage["tone"], message: string, action?: Pick<ToastMessage, "actionLabel" | "onAction">) => {
      setToast({ id: Date.now(), tone, message, ...action });
    },
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);
  const showError = useCallback(
    (error: unknown) => showToast("error", formatError(error)),
    [showToast],
  );

  const resetPracticeUi = useCallback(() => {
    setActiveCardId(null);
    setResponseText("");
    setIsRevealed(false);
    setStartedAt(Date.now());
  }, []);

  const resetPracticeSession = useCallback(() => {
    resetPracticeUi();
    setSession(newSession());
    setExtraNew(0);
    setLastReview(null);
  }, [resetPracticeUi]);

  const clearUserState = useCallback(() => {
    setAuthStatus("signed-out");
    setUser(null);
    setProfile(null);
    setState(null);
    setIsPasswordRecovery(false);
    loadingUserIdRef.current = null;
    loadedUserIdRef.current = null;
    resetPracticeSession();
  }, [resetPracticeSession]);

  // Re-evaluate the due queue every minute so learning steps reappear on time.
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(interval);
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
      setLoadError(null);

      try {
        const [stateResult, profileResult] = await Promise.all([
          loadMemoraStateAction(),
          loadProfileAction(),
        ]);
        setState(unwrapActionState(stateResult));
        setProfile(unwrapProfile(profileResult));
        resetPracticeSession();
        loadedUserIdRef.current = nextUser.id;
      } catch (error) {
        setLoadError(formatError(error));
      } finally {
        if (loadingUserIdRef.current === nextUser.id) {
          loadingUserIdRef.current = null;
        }
      }
    },
    [resetPracticeSession],
  );

  /** Silently re-syncs state with the server, keeping the practice session. */
  const refreshState = useCallback(async () => {
    try {
      setState(unwrapActionState(await loadMemoraStateAction()));
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error || !data.session?.user) {
        clearUserState();
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
        clearUserState();
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        setActiveView("account");
      }

      setAuthStatus("signed-in");
      setUser(session.user);
      void loadUserData(session.user);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearUserState, loadUserData, supabase]);

  const queue = useMemo(() => {
    if (!state) return [];
    return getDueQueue(state, state.settings.studyMode, new Date(clock), {
      extraNew,
    });
    // `clock` intentionally re-runs this when time passes.
  }, [clock, extraNew, state]);

  const summary = useMemo(
    () => (state ? summarizeState(state, new Date(clock), { extraNew }) : null),
    [clock, extraNew, state],
  );
  const modeCounts = useMemo(() => {
    const counts = { daily: 0, "english-productive": 0, "qa-interview": 0 } as Record<
      StudyMode,
      number
    >;
    if (!state) return counts;
    for (const mode of studyModes) {
      counts[mode] = getDueQueue(state, mode, new Date(clock), { extraNew }).length;
    }
    return counts;
  }, [clock, extraNew, state]);
  const heldBackNew = useMemo(
    () =>
      state
        ? countHeldBackNew(state, state.settings.studyMode, new Date(clock), { extraNew })
        : 0,
    [clock, extraNew, state],
  );
  const nextDue = useMemo(
    () => (state ? nextDueAt(state, state.settings.studyMode, new Date(clock)) : null),
    [clock, state],
  );
  const streakStats = useMemo(
    () => buildStreakStats(state?.reviewLogs ?? []),
    [state],
  );
  const notesById = useMemo(
    () => new Map((state?.notes ?? []).map((note) => [note.id, note])),
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
  const navBadges: Partial<Record<AppView, number>> = {
    today: modeCounts[state?.settings.studyMode ?? "daily"] || undefined,
  };

  const navigateToView = useCallback((view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0 });
  }, []);

  function toggleSidebar() {
    setIsSidebarCollapsed((value) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, value ? "0" : "1");
      } catch {
        // Ignore storage failures.
      }
      return !value;
    });
  }

  async function handleSignIn(email: string, password: string) {
    setAuthMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function handleSignUp(email: string, password: string) {
    setAuthMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window === "undefined" ? undefined : window.location.origin,
      },
    });
    if (error) throw error;

    // Supabase hides existing accounts: it "succeeds" with no identities and
    // sends no email, so tell the learner to sign in instead.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      throw new Error(
        "Акаунт з таким email уже існує. Увійди або скористайся «Забули пароль?».",
      );
    }

    if (!data.session) {
      setAuthMessage(
        "Акаунт створено. Ми надіслали лист для підтвердження — перейди за посиланням, і можна починати.",
      );
    }
  }

  async function handlePasswordReset(email: string) {
    const cleanEmail = email.trim();
    if (!cleanEmail) throw new Error("Вкажи email, на який надіслати лист.");

    setAuthMessage(null);
    const redirectTo =
      typeof window === "undefined" ? undefined : window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });
    if (error) throw error;

    const message = "Лист для відновлення пароля надіслано. Перевір пошту.";
    setAuthMessage(message);
    if (authStatus === "signed-in") showToast("success", message);
  }

  async function handleSignOut() {
    setIsMutating(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearUserState();
    } catch (error) {
      showError(error);
    } finally {
      setIsMutating(false);
    }
  }

  /** Runs a full-state mutation with shared busy/error handling. */
  async function runMutation(
    action: () => Promise<MemoraState>,
    options: { success?: string; resetSession?: boolean; rethrow?: boolean } = {},
  ) {
    if (isMutating) return;

    setIsMutating(true);
    try {
      const nextState = await action();
      setState(nextState);
      if (options.resetSession) resetPracticeSession();
      if (options.success) showToast("success", options.success);
      return nextState;
    } catch (error) {
      showError(error);
      if (options.rethrow) throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSettingsChange(settings: AppSettings) {
    if (!state) return;

    const previousState = state;
    const isModeChange = settings.studyMode !== previousState.settings.studyMode;
    pendingSettingsRef.current = settings;
    setState({ ...state, settings });
    if (isModeChange) resetPracticeSession();

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
          setState((current) =>
            current ? { ...current, settings: updatedState.settings } : updatedState,
          );
        }
      }
    } catch (error) {
      pendingSettingsRef.current = null;
      setState((current) =>
        current ? { ...current, settings: previousState.settings } : previousState,
      );
      showError(error);
      throw error;
    } finally {
      isSavingSettingsRef.current = false;
    }
  }

  async function handleProfileSave(draft: UserProfileDraft) {
    if (isMutating) return;

    setIsMutating(true);
    try {
      setProfile(unwrapProfile(await updateProfileAction(draft)));
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handlePasswordUpdate(password: string) {
    if (isMutating) return;

    const nextPassword = password.trim();
    if (nextPassword.length < 8) {
      throw new Error("Пароль має містити щонайменше 8 символів.");
    }

    setIsMutating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) throw error;
      setIsPasswordRecovery(false);
      showToast("success", "Пароль оновлено.");
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  /**
   * Grades the active card optimistically: the next card appears instantly
   * and the server write runs in an ordered background chain.
   */
  function submitReview(rating: ReviewRating) {
    if (!state || !activeCard) return;

    const card = activeCard;
    const reviewedAt = new Date();
    const elapsedMs = Math.min(reviewedAt.getTime() - startedAt, 30 * 60_000);
    const response = responseText.trim();
    const { schedule } = scheduleReview(card.schedule, rating, reviewedAt);
    const tempLogId = `pending-${reviewedAt.getTime()}-${card.id}`;
    const wasCorrect = rating !== "again";
    const optimisticLog: ReviewLog = {
      id: tempLogId,
      cardId: card.id,
      noteId: card.noteId,
      module: card.module,
      rating,
      responseText: response,
      elapsedMs,
      reviewedAt: reviewedAt.toISOString(),
      dueBefore: card.schedule.due,
      dueAfter: schedule.due,
      wasCorrect,
    };

    setState((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((item) =>
              item.id === card.id ? { ...item, schedule } : item,
            ),
            reviewLogs: [...current.reviewLogs, optimisticLog],
          }
        : current,
    );
    setSession((current) => ({
      ...current,
      reviewed: current.reviewed + 1,
      correct: current.correct + (wasCorrect ? 1 : 0),
    }));
    resetPracticeUi();

    const serverLogId = reviewChainRef.current
      .catch(() => undefined)
      .then(() =>
        gradeCardAction({
          cardId: card.id,
          rating,
          responseText: response,
          elapsedMs,
        }),
      )
      .then((result) => {
        if (!result.ok) throw new Error(result.error);
        setState((current) =>
          current
            ? {
                ...current,
                cards: current.cards.map((item) =>
                  item.id === result.cardId
                    ? { ...item, schedule: result.schedule }
                    : item,
                ),
                reviewLogs: current.reviewLogs.map((log) =>
                  log.id === tempLogId ? result.log : log,
                ),
              }
            : current,
        );
        return result.log.id;
      })
      .catch((error: unknown) => {
        showToast("error", `Оцінку не збережено: ${formatError(error)}`);
        void refreshState();
        return null;
      });

    reviewChainRef.current = serverLogId;
    setLastReview({
      cardId: card.id,
      previousSchedule: card.schedule,
      tempLogId,
      wasCorrect,
      serverLogId,
    });
  }

  async function undoLastReview() {
    const review = lastReview;
    if (!review) return;

    setLastReview(null);
    setState((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((item) =>
              item.id === review.cardId
                ? { ...item, schedule: review.previousSchedule }
                : item,
            ),
            reviewLogs: current.reviewLogs.filter(
              (log) => log.id !== review.tempLogId,
            ),
          }
        : current,
    );
    setSession((current) => ({
      ...current,
      reviewed: Math.max(0, current.reviewed - 1),
      correct: Math.max(0, current.correct - (review.wasCorrect ? 1 : 0)),
    }));
    setActiveCardId(review.cardId);
    setResponseText("");
    setIsRevealed(false);
    setStartedAt(Date.now());

    const logId = await review.serverLogId;
    if (!logId) return;

    setState((current) =>
      current
        ? {
            ...current,
            reviewLogs: current.reviewLogs.filter((log) => log.id !== logId),
          }
        : current,
    );

    const result = await undoReviewAction(logId);
    if (!result.ok) {
      showToast("error", `Не вдалося скасувати: ${result.error}`);
      void refreshState();
    }
  }

  async function pauseCard(cardId: string) {
    setState((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((item) =>
              item.id === cardId ? { ...item, status: "suspended" } : item,
            ),
          }
        : current,
    );
    resetPracticeUi();

    const result = await pauseCardAction(cardId);
    if (!result.ok) {
      showToast("error", result.error);
      void refreshState();
      return;
    }

    showToast("info", "Картку поставлено на паузу.", {
      actionLabel: "Повернути",
      onAction: () => {
        void updateCardStatusAction(cardId, "active").then((restore) => {
          if (restore.ok) setState(restore.state);
          else showToast("error", restore.error);
        });
      },
    });
  }

  function openNote(noteId: string) {
    const note = state?.notes.find((item) => item.id === noteId);
    if (!note) return;
    setSelectedNoteId(noteId);
    navigateToView(note.module);
  }

  async function handleNoteStatusChange(noteId: string, status: ItemStatus) {
    await runMutation(
      async () => unwrapActionState(await updateNoteStatusAction(noteId, status)),
      { success: `Матеріал ${labelStatus(status)}.` },
    );
  }

  async function handleNoteDelete(noteId: string) {
    await runMutation(
      async () => {
        const nextState = unwrapActionState(await deleteNoteAction(noteId));
        setSelectedNoteId(null);
        return nextState;
      },
      { success: "Матеріал видалено.", resetSession: true, rethrow: true },
    );
  }

  async function handleNoteContentChange(noteId: string, content: NoteContentDraft) {
    await runMutation(
      async () => unwrapActionState(await updateNoteContentAction(noteId, content)),
      { success: "Зміни збережено.", rethrow: true },
    );
  }

  async function handleAddEnglish(draft: EnglishDraft) {
    await runMutation(
      async () => unwrapActionState(await addEnglishNoteAction(draft)),
      { success: `«${draft.lemma}» додано — 2 нові картки в черзі.`, rethrow: true },
    );
  }

  async function handleAddQa(draft: QaDraft) {
    await runMutation(
      async () => unwrapActionState(await addQaNoteAction(draft)),
      { success: `«${draft.term}» додано — 2 нові картки в черзі.`, rethrow: true },
    );
  }

  async function handleImportNotes(
    moduleType: ModuleType,
    rows: ClientImportCommitRow[],
    skipDuplicates: boolean,
    fileName: string | null,
  ): Promise<ImportResultSummary> {
    const empty = { importedCount: 0, skippedDuplicates: 0, invalidRows: 0 };
    if (isMutating) return empty;

    setIsMutating(true);
    try {
      const options = { fileName: fileName ?? undefined, skipDuplicates };
      const result =
        moduleType === "english"
          ? await importEnglishNotesAction(
              rows as Array<ClientImportCommitRow & { draft?: EnglishDraft }>,
              options,
            )
          : await importQaNotesAction(
              rows as Array<ClientImportCommitRow & { draft?: QaDraft }>,
              options,
            );

      if (!result.ok) throw new Error(result.error);

      setState(result.state);
      showToast("success", `Імпортовано: ${result.importedCount}.`);

      return {
        importedCount: result.importedCount,
        skippedDuplicates: result.skippedDuplicates,
        invalidRows: result.invalidRows,
      };
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRestoreBackup(backup: BackupDocument) {
    await runMutation(
      async () => {
        const nextState = unwrapActionState(await restoreBackupAction(backup));
        setSelectedNoteId(null);
        return nextState;
      },
      { success: "Резервну копію відновлено.", resetSession: true, rethrow: true },
    );
  }

  async function handleClearMaterials() {
    await runMutation(
      async () => {
        const nextState = unwrapActionState(await clearMaterialsAction());
        setSelectedNoteId(null);
        return nextState;
      },
      { success: "Усі матеріали видалено.", resetSession: true, rethrow: true },
    );
  }

  async function handleResetLearningStats() {
    await runMutation(
      async () => unwrapActionState(await resetLearningStatsAction()),
      { success: "Статистику обнулено.", resetSession: true, rethrow: true },
    );
  }

  if (authStatus === "loading") {
    return <LoadingScreen />;
  }

  if (authStatus === "signed-out") {
    return (
      <LandingPage
        statusMessage={authMessage}
        onResetPassword={handlePasswordReset}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
      />
    );
  }

  if (!state || !summary) {
    return (
      <LoadingScreen
        error={loadError}
        onRetry={user ? () => void loadUserData(user, { force: true }) : undefined}
      />
    );
  }

  return (
    <div className="flex min-h-svh bg-ink text-text">
      <Sidebar
        activeView={activeView}
        badges={navBadges}
        isBusy={isMutating}
        isCollapsed={isSidebarCollapsed}
        streakStats={streakStats}
        userEmail={user?.email}
        onNavigate={navigateToView}
        onSignOut={() => void handleSignOut()}
        onToggleCollapsed={toggleSidebar}
      />

      <div className="min-w-0 flex-1">
        <MobileTopBar
          streakStats={streakStats}
          title={activeView === "today" ? "Memora" : currentViewLabel}
          onOpenHelp={() => navigateToView("help")}
        />

        <main className="pb-safe-nav mx-auto w-full max-w-[1200px] px-4 pt-5 md:px-6 md:pt-8 lg:px-10 lg:pb-12">
          {isPasswordRecovery && activeView !== "account" ? (
            <StatusBanner
              className="mb-5"
              tone="success"
              message="Задай новий пароль у профілі, щоб завершити відновлення доступу."
            />
          ) : null}

          {activeView === "today" ? (
            <PracticeWorkspace
              canUndo={lastReview !== null}
              card={activeCard}
              hasMaterials={state.cards.some((card) => card.status === "active")}
              heldBackNew={heldBackNew}
              isRevealed={isRevealed}
              modeCounts={modeCounts}
              nextDue={nextDue}
              note={activeCard ? (notesById.get(activeCard.noteId) ?? null) : null}
              queueLength={queue.length}
              responseText={responseText}
              reviewButtons={state.settings.reviewButtons}
              session={session}
              streakStats={streakStats}
              studyMode={state.settings.studyMode}
              summary={summary}
              onEditNote={openNote}
              onLearnMore={(count) => setExtraNew((value) => value + count)}
              onModeChange={(studyMode) => {
                void handleSettingsChange({ ...state.settings, studyMode }).catch(
                  () => undefined,
                );
              }}
              onNavigate={navigateToView}
              onPause={(cardId) => void pauseCard(cardId)}
              onResponseChange={setResponseText}
              onReveal={() => setIsRevealed(true)}
              onReview={submitReview}
              onUndo={() => void undoLastReview()}
            />
          ) : activeView === "account" ? (
            <AccountWorkspace
              key={`${profile?.updatedAt ?? user?.id ?? "account"}:${state.settings.dailyNewLimit}:${state.settings.reviewButtons}`}
              isBusy={isMutating}
              isPasswordRecovery={isPasswordRecovery}
              profile={profile}
              state={state}
              user={user}
              onClearMaterials={handleClearMaterials}
              onNavigate={navigateToView}
              onPasswordReset={handlePasswordReset}
              onPasswordUpdate={handlePasswordUpdate}
              onProfileSave={handleProfileSave}
              onResetLearningStats={handleResetLearningStats}
              onRestoreBackup={handleRestoreBackup}
              onSaved={() => showToast("success", "Налаштування збережено.")}
              onSettingsChange={handleSettingsChange}
              onSignOut={() => void handleSignOut()}
            />
          ) : activeView === "help" ? (
            <HelpWorkspace />
          ) : activeView === "analytics" ? (
            <AnalyticsWorkspace
              state={state}
              summary={summary}
              onOpenNote={openNote}
            />
          ) : contentModule ? (
            <ContentManager
              key={contentModule}
              cards={state.cards}
              imports={state.imports}
              isBusy={isMutating}
              moduleType={contentModule}
              notes={contentNotes}
              reviewLogs={state.reviewLogs}
              selectedNote={selectedNote}
              onAddEnglish={handleAddEnglish}
              onAddQa={handleAddQa}
              onImport={(rows, skipDuplicates, fileName) =>
                handleImportNotes(contentModule, rows, skipDuplicates, fileName)
              }
              onNoteContentChange={handleNoteContentChange}
              onNoteDelete={handleNoteDelete}
              onNoteSelect={setSelectedNoteId}
              onNoteStatusChange={(noteId, status) =>
                void handleNoteStatusChange(noteId, status)
              }
            />
          ) : null}
        </main>
      </div>

      <MobileTabBar
        activeView={activeView}
        badges={navBadges}
        onNavigate={navigateToView}
      />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
