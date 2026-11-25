"use client";

import { CircleHelp, Download, Flame, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { updateTimezoneAction } from "@/lib/memora/actions/account";
import { buildWeek } from "@/lib/memora/progress";
import { markReviewedToday, pluralizeDays, streakMessage } from "@/lib/memora/streak";
import type { StreakSummary } from "@/lib/memora/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LogoMark, Wordmark } from "./brand";
import { Toast, type ToastMessage } from "./shared-ui";
import { isNavActive, navigationItems, sectionTitle } from "./types";
import { formatError } from "./utils";
import { hardNavigate } from "./hard-navigate";
import { registerServiceWorker, useInstallPrompt } from "./pwa";

const SIDEBAR_COOKIE = "memora-sidebar";

type ShellContextValue = {
  showToast: (
    tone: ToastMessage["tone"],
    message: string,
    action?: Pick<ToastMessage, "actionLabel" | "onAction">,
  ) => void;
  showError: (error: unknown) => void;
  /** Updates the practice badge in the navigation. */
  setDueCount: (count: number) => void;
  /** Optimistically lights up today's streak after the first review. */
  markReviewed: () => void;
  streak: StreakSummary;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside <AppShell>.");
  return value;
}

type ShellProps = {
  children: React.ReactNode;
  email: string | null;
  streak: StreakSummary;
  dueCount: number;
  timezone: string;
  sidebarCollapsed: boolean;
};

export function AppShell({ children, email, streak, dueCount, timezone, sidebarCollapsed }: ShellProps) {
  const pathname = usePathname();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(sidebarCollapsed);
  // Server data wins whenever the layout re-renders (router.refresh);
  // in between, practice updates it optimistically.
  const [live, setLive] = useState({ streak, dueCount, source: { streak, dueCount } });
  if (live.source.streak !== streak || live.source.dueCount !== dueCount) {
    setLive({ streak, dueCount, source: { streak, dueCount } });
  }

  const showToast = useCallback<ShellContextValue["showToast"]>((tone, message, action) => {
    setToast({ id: Date.now(), tone, message, ...action });
  }, []);
  const showError = useCallback((error: unknown) => showToast("error", formatError(error)), [showToast]);
  const dismissToast = useCallback(() => setToast(null), []);
  const setDueCount = useCallback(
    (count: number) => setLive((current) => (current.dueCount === count ? current : { ...current, dueCount: count })),
    [],
  );
  const markReviewed = useCallback(
    () =>
      setLive((current) =>
        current.streak.reviewedToday ? current : { ...current, streak: markReviewedToday(current.streak) },
      ),
    [],
  );

  // Keep "today" (streak, daily limits) in the learner's own timezone.
  // Saved silently: a router.refresh here would remount the current page and
  // wipe an in-progress practice card. The new zone applies on next navigation.
  useEffect(() => registerServiceWorker(), []);

  useEffect(() => {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserZone || browserZone === timezone) return;
    void updateTimezoneAction(browserZone);
  }, [timezone]);

  function toggleSidebar() {
    setIsCollapsed((value) => {
      document.cookie = `${SIDEBAR_COOKIE}=${value ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
      return !value;
    });
  }

  async function signOut() {
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      hardNavigate("/");
    } catch (error) {
      showError(error);
    }
  }

  const context = useMemo<ShellContextValue>(
    () => ({ showToast, showError, setDueCount, markReviewed, streak: live.streak }),
    [live.streak, markReviewed, setDueCount, showError, showToast],
  );

  return (
    <ShellContext.Provider value={context}>
      <div className="flex min-h-svh bg-ink text-text">
        <Sidebar
          dueCount={live.dueCount}
          email={email}
          isCollapsed={isCollapsed}
          pathname={pathname}
          streak={live.streak}
          onSignOut={() => void signOut()}
          onToggleCollapsed={toggleSidebar}
        />
        <div className="min-w-0 flex-1">
          <MobileTopBar pathname={pathname} streak={live.streak} />
          <main className="pb-safe-nav mx-auto w-full max-w-[1200px] px-4 pt-5 md:px-6 md:pt-8 lg:px-10 lg:pb-12">
            {children}
          </main>
        </div>
        <MobileTabBar dueCount={live.dueCount} pathname={pathname} />
        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    </ShellContext.Provider>
  );
}

function Sidebar({
  dueCount,
  email,
  isCollapsed,
  pathname,
  streak,
  onSignOut,
  onToggleCollapsed,
}: {
  dueCount: number;
  email: string | null;
  isCollapsed: boolean;
  pathname: string;
  streak: StreakSummary;
  onSignOut: () => void;
  onToggleCollapsed: () => void;
}) {
  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = isCollapsed ? "Розгорнути меню" : "Згорнути меню";

  return (
    <aside
      className={`sticky top-0 hidden h-svh shrink-0 flex-col border-r border-line bg-surface-1/70 backdrop-blur-xl transition-[width] duration-300 lg:flex ${
        isCollapsed ? "w-[76px]" : "w-64"
      }`}
    >
      <div className={`flex h-16 items-center ${isCollapsed ? "justify-center" : "justify-between pl-5 pr-3"}`}>
        {isCollapsed ? (
          <button
            aria-label={toggleLabel}
            className="rounded-xl transition hover:opacity-80"
            onClick={onToggleCollapsed}
            title={toggleLabel}
            type="button"
          >
            <LogoMark className="size-8" />
          </button>
        ) : (
          <>
            <Link aria-label="Memora — практика" href="/app">
              <Wordmark />
            </Link>
            <button
              aria-label={toggleLabel}
              className="grid size-9 place-items-center rounded-lg text-faint transition hover:bg-surface-3 hover:text-text"
              onClick={onToggleCollapsed}
              title={toggleLabel}
              type="button"
            >
              <ToggleIcon className="size-4" />
            </button>
          </>
        )}
      </div>

      <nav aria-label="Розділи" className="mt-2 flex-1 space-y-1 px-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(item.href, pathname);
          const badge = item.href === "/app" && dueCount > 0 ? dueCount : null;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              key={item.href}
              className={`group relative flex w-full items-center rounded-xl text-sm font-medium transition ${
                isCollapsed ? "h-11 justify-center" : "h-10 gap-3 px-3"
              } ${isActive ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2 hover:text-text"}`}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
              ) : null}
              <Icon className={`size-[18px] ${isActive ? "text-accent" : ""}`} />
              {isCollapsed ? (
                <>
                  <span className="sr-only">{item.label}</span>
                  {badge ? <span className="absolute right-2 top-2 size-2 rounded-full bg-accent" /> : null}
                </>
              ) : (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge ? (
                    <span className="rounded-md bg-accent-soft px-1.5 font-mono text-[11px] leading-5 text-accent">
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 px-3 pb-4">
        {streak.streak === 0 ? null : isCollapsed ? <StreakChip compact streak={streak} /> : <StreakCard streak={streak} />}
        <button
          className={`flex w-full items-center rounded-xl text-sm text-muted transition hover:bg-surface-2 hover:text-text ${
            isCollapsed ? "h-11 justify-center" : "h-10 gap-3 px-3"
          }`}
          onClick={onSignOut}
          title={isCollapsed ? "Вийти" : undefined}
          type="button"
        >
          <LogOut className="size-[18px]" />
          {isCollapsed ? (
            <span className="sr-only">Вийти</span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-left">
              Вийти
              {email ? <span className="block truncate text-xs text-faint">{email}</span> : null}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

function StreakCard({ streak }: { streak: StreakSummary }) {
  const isHot = streak.streak > 0 && streak.reviewedToday;

  return (
    <section
      aria-label={`Серія: ${streak.streak} ${pluralizeDays(streak.streak)}`}
      className="rounded-2xl border border-line bg-surface-2/70 p-3.5"
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid size-9 place-items-center rounded-xl ${
            isHot ? "bg-amber-soft text-amber" : streak.streak > 0 ? "bg-accent-soft text-accent" : "bg-surface-3 text-faint"
          }`}
        >
          <Flame className={`size-[18px] ${isHot ? "fill-amber/30" : ""}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">
            {streak.streak} {pluralizeDays(streak.streak)}
          </p>
          <p className="truncate text-xs text-muted">{streakMessage(streak)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {buildWeek(streak).map((day) => (
          <div
            key={day.day}
            className="grid justify-items-center gap-1"
            title={`${day.label}: ${day.isCompleted ? "була практика" : "без практики"}`}
          >
            <span
              className={`h-1.5 w-full rounded-full ${
                day.isCompleted ? "bg-accent" : day.isToday ? "bg-accent/25" : "bg-surface-4"
              }`}
            />
            <span className={`text-[10px] ${day.isToday ? "font-semibold text-text-2" : "text-faint"}`}>
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StreakChip({ compact = false, streak }: { compact?: boolean; streak: StreakSummary }) {
  const isHot = streak.streak > 0 && streak.reviewedToday;
  const label = `Серія: ${streak.streak} ${pluralizeDays(streak.streak)}`;

  return (
    <div
      aria-label={label}
      className={`flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2/80 font-mono text-sm font-semibold ${
        compact ? "h-11 w-full" : "h-10 px-2.5"
      } ${isHot ? "text-amber" : streak.streak > 0 ? "text-accent" : "text-faint"}`}
      title={label}
    >
      <Flame className={`size-4 ${isHot ? "fill-amber/30" : ""}`} />
      {streak.streak}
    </div>
  );
}

function MobileTopBar({ pathname, streak }: { pathname: string; streak: StreakSummary }) {
  const isHelp = isNavActive("/app/help", pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link className="flex min-w-0 items-center gap-2.5" href="/app">
          <LogoMark className="size-7" />
          <span className="truncate text-[15px] font-semibold">{sectionTitle(pathname)}</span>
        </Link>
        <div className="flex items-center gap-2">
          <InstallButton />
          {streak.streak > 0 ? <StreakChip streak={streak} /> : null}
          <Link
            aria-current={isHelp ? "page" : undefined}
            aria-label="Довідка"
            className={`grid size-10 place-items-center rounded-xl border bg-surface-2/80 transition hover:text-text ${
              isHelp ? "border-accent/50 text-accent" : "border-line text-muted"
            }`}
            href="/app/help"
          >
            <CircleHelp className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

const installDismissedKey = "memora.install-dismissed";
const installQuietDays = 30;

/** A quiet "Install" pill: only when Chrome offers it, hidden for a month after "No". */
function InstallButton() {
  const { state, install } = useInstallPrompt();
  /** null until read from localStorage (not available on the server). */
  const [isQuiet, setIsQuiet] = useState<boolean | null>(null);
  useEffect(() => {
    const dismissedAt = Number(window.localStorage.getItem(installDismissedKey)) || 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsQuiet(Date.now() - dismissedAt < installQuietDays * 86_400_000);
  }, []);
  if (state !== "available" || isQuiet !== false) return null;

  return (
    <button
      className="flex h-10 items-center gap-1.5 rounded-xl border border-accent/30 bg-accent-soft px-3 text-sm font-semibold text-accent transition hover:border-accent/60"
      onClick={async () => {
        if ((await install()) === "dismissed") {
          window.localStorage.setItem(installDismissedKey, String(Date.now()));
          setIsQuiet(true);
        }
      }}
      type="button"
    >
      <Download className="size-4" />
      Встановити
    </button>
  );
}

function MobileTabBar({ dueCount, pathname }: { dueCount: number; pathname: string }) {
  const items = navigationItems.filter((item) => item.inTabBar);

  return (
    <nav
      aria-label="Розділи"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-ink/90 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-4 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(item.href, pathname);
          const badge = item.href === "/app" && dueCount > 0 ? dueCount : null;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              key={item.href}
              className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                isActive ? "text-text" : "text-faint"
              }`}
              href={item.href}
            >
              <span
                className={`relative grid h-7 w-12 place-items-center rounded-full transition ${
                  isActive ? "bg-accent-soft text-accent" : ""
                }`}
              >
                <Icon className="size-5" />
                {badge ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-accent px-1 font-mono text-[10px] font-semibold leading-4 text-accent-ink"
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              {item.label}
              {badge ? <span className="sr-only">, {badge} на сьогодні</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
