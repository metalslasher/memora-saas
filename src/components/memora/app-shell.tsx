"use client";

import {
  CircleHelp,
  Flame,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { pluralizeDays, type StreakStats } from "@/lib/memora/streak";
import { LogoMark, Wordmark } from "./brand";
import type { AppView } from "./types";
import { navigationItems } from "./types";

export function Sidebar({
  activeView,
  badges,
  isBusy,
  isCollapsed,
  onNavigate,
  onSignOut,
  onToggleCollapsed,
  streakStats,
  userEmail,
}: {
  activeView: AppView;
  badges: Partial<Record<AppView, number>>;
  isBusy: boolean;
  isCollapsed: boolean;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
  onToggleCollapsed: () => void;
  streakStats: StreakStats;
  userEmail?: string;
}) {
  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = isCollapsed ? "Розгорнути меню" : "Згорнути меню";

  return (
    <aside
      className={`sticky top-0 hidden h-svh shrink-0 flex-col border-r border-line bg-surface-1/70 backdrop-blur-xl transition-[width] duration-300 lg:flex ${
        isCollapsed ? "w-[76px]" : "w-64"
      }`}
    >
      <div
        className={`flex h-16 items-center ${
          isCollapsed ? "justify-center" : "justify-between pl-5 pr-3"
        }`}
      >
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
            <Wordmark />
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

      <nav
        aria-label="Розділи"
        className={`mt-2 flex-1 space-y-1 ${isCollapsed ? "px-3" : "px-3"}`}
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          const badge = badges[item.view];

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              key={item.view}
              className={`group relative flex w-full items-center rounded-xl text-sm font-medium transition ${
                isCollapsed ? "h-11 justify-center" : "h-10 gap-3 px-3"
              } ${
                isActive
                  ? "bg-surface-3 text-text"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
              onClick={() => onNavigate(item.view)}
              title={isCollapsed ? item.label : undefined}
              type="button"
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
              ) : null}
              <Icon
                className={`size-[18px] ${isActive ? "text-accent" : ""}`}
              />
              {isCollapsed ? (
                badge ? (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-accent" />
                ) : null
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
            </button>
          );
        })}
      </nav>

      <div className={`space-y-2 pb-4 ${isCollapsed ? "px-3" : "px-3"}`}>
        {isCollapsed ? (
          <StreakChip stats={streakStats} compact />
        ) : (
          <StreakCard stats={streakStats} />
        )}
        <button
          className={`flex w-full items-center rounded-xl text-sm text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50 ${
            isCollapsed ? "h-11 justify-center" : "h-10 gap-3 px-3"
          }`}
          disabled={isBusy}
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
              {userEmail ? (
                <span className="block truncate text-xs text-faint">{userEmail}</span>
              ) : null}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

export function StreakCard({ stats }: { stats: StreakStats }) {
  const isHot = stats.count > 0 && stats.reviewedToday;

  return (
    <section
      aria-label={`Серія: ${stats.count} ${pluralizeDays(stats.count)}`}
      className="rounded-2xl border border-line bg-surface-2/70 p-3.5"
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid size-9 place-items-center rounded-xl ${
            isHot
              ? "bg-amber-soft text-amber"
              : stats.count > 0
                ? "bg-accent-soft text-accent"
                : "bg-surface-3 text-faint"
          }`}
        >
          <Flame className={`size-[18px] ${isHot ? "fill-amber/30" : ""}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">
            {stats.count} {pluralizeDays(stats.count)}
          </p>
          <p className="truncate text-xs text-muted">{stats.message}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {stats.week.map((day) => (
          <div
            key={day.key}
            className="grid justify-items-center gap-1"
            title={`${day.label}: ${day.isCompleted ? "була практика" : "без практики"}`}
          >
            <span
              className={`h-1.5 w-full rounded-full ${
                day.isCompleted
                  ? "bg-accent"
                  : day.isToday
                    ? "bg-accent/25"
                    : "bg-surface-4"
              }`}
            />
            <span
              className={`text-[10px] ${day.isToday ? "font-semibold text-text-2" : "text-faint"}`}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StreakChip({
  compact = false,
  stats,
}: {
  compact?: boolean;
  stats: StreakStats;
}) {
  const isHot = stats.count > 0 && stats.reviewedToday;

  return (
    <div
      aria-label={`Серія: ${stats.count} ${pluralizeDays(stats.count)}`}
      className={`flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2/80 font-mono text-sm font-semibold ${
        compact ? "h-11 w-full" : "h-9 px-2.5"
      } ${isHot ? "text-amber" : stats.count > 0 ? "text-accent" : "text-faint"}`}
      title={`Серія: ${stats.count} ${pluralizeDays(stats.count)}`}
    >
      <Flame className={`size-4 ${isHot ? "fill-amber/30" : ""}`} />
      {stats.count}
    </div>
  );
}

export function MobileTopBar({
  onOpenHelp,
  streakStats,
  title,
}: {
  onOpenHelp: () => void;
  streakStats: StreakStats;
  title: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="truncate text-[15px] font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <StreakChip stats={streakStats} />
          <button
            aria-label="Довідка"
            className="grid size-9 place-items-center rounded-xl border border-line bg-surface-2/80 text-muted transition hover:text-text"
            onClick={onOpenHelp}
            type="button"
          >
            <CircleHelp className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileTabBar({
  activeView,
  badges,
  onNavigate,
}: {
  activeView: AppView;
  badges: Partial<Record<AppView, number>>;
  onNavigate: (view: AppView) => void;
}) {
  const items = navigationItems.filter((item) => item.view !== "help");

  return (
    <nav
      aria-label="Розділи"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-ink/90 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeView === item.view ||
            (item.view === "account" && activeView === "help");
          const badge = badges[item.view];

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              key={item.view}
              className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                isActive ? "text-text" : "text-faint"
              }`}
              onClick={() => onNavigate(item.view)}
              type="button"
            >
              <span
                className={`relative grid h-7 w-12 place-items-center rounded-full transition ${
                  isActive ? "bg-accent-soft text-accent" : ""
                }`}
              >
                <Icon className="size-5" />
                {badge ? (
                  <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-accent px-1 font-mono text-[10px] font-semibold leading-4 text-accent-ink">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              {item.shortLabel}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
