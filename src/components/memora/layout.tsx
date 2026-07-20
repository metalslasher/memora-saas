"use client";

import { Brain, Flame, LogOut, Menu, Sparkles, Target, X } from "lucide-react";
import { pluralizeDays, type StreakStats } from "@/lib/memora/streak";
import type { AppView, IconType } from "./types";
import { navigationItems } from "./types";
import { ShellPanel } from "./shared-ui";

export function BrandLockup({
  isCollapsed = false,
  onToggleSidebar,
}: {
  isCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const toggleLabel = isCollapsed
    ? "Розгорнути бокове меню"
    : "Згорнути бокове меню";

  return (
    <div className="flex items-center gap-3">
      {onToggleSidebar ? (
        <button
          aria-label={toggleLabel}
          className="group -m-1 grid size-9 place-items-center rounded-lg text-[#eef4ff] transition hover:text-[#52e0c4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2dd4bf]"
          onClick={onToggleSidebar}
          title={toggleLabel}
          type="button"
        >
          <Brain
            className="size-7 shrink-0 drop-shadow-[0_0_14px_rgba(238,244,255,0.28)] transition group-hover:drop-shadow-[0_0_18px_rgba(45,212,191,0.35)]"
            strokeWidth={1.8}
          />
        </button>
      ) : (
        <Brain
          className="size-7 shrink-0 text-[#eef4ff] drop-shadow-[0_0_14px_rgba(238,244,255,0.28)]"
          strokeWidth={1.8}
        />
      )}
      <p className={`text-lg font-semibold leading-6 ${isCollapsed ? "sr-only" : ""}`}>
        Memora
      </p>
    </div>
  );
}

export function NavigationList({
  activeView,
  className = "",
  isCollapsed = false,
  onNavigate,
}: {
  activeView: AppView;
  className?: string;
  isCollapsed?: boolean;
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
          isCollapsed={isCollapsed}
          onClick={() => onNavigate(item.view)}
        />
      ))}
    </nav>
  );
}

export function CollapsedStreakButton({ stats }: { stats: StreakStats }) {
  const streakVisual = getStreakVisual(stats.count);
  const StreakIcon = streakVisual.icon;

  return (
    <div
      aria-label={`Серія навчання: ${stats.count} ${pluralizeDays(stats.count)}`}
      className="grid h-11 w-full place-items-center rounded-lg border border-[#263140] bg-[#101923]"
      title={`Серія: ${stats.count} ${pluralizeDays(stats.count)}`}
    >
      <div
        className={`grid size-8 place-items-center rounded-lg ${streakVisual.containerClass}`}
      >
        <StreakIcon className={`size-4 ${streakVisual.iconClass}`} />
      </div>
    </div>
  );
}

export function StudyStreakWidget({
  className = "",
  compact = false,
  stats,
}: {
  className?: string;
  compact?: boolean;
  stats: StreakStats;
}) {
  const streakLabel = pluralizeDays(stats.count);
  const cardLabel = `${stats.count} ${streakLabel}`;
  const streakVisual = getStreakVisual(stats.count);
  const StreakIcon = streakVisual.icon;

  return (
    <section
      aria-label={`Серія навчання: ${cardLabel}`}
      className={`overflow-hidden rounded-lg border border-[#263140] bg-[#101923] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-lg ${streakVisual.containerClass}`}
          title={streakVisual.title}
        >
          <StreakIcon className={`size-5 ${streakVisual.iconClass}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold leading-none text-white">
              {stats.count}
            </span>
            <span className="text-sm font-medium leading-5 text-[#c7d0dd]">
              {streakLabel}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`mt-3 grid grid-cols-7 ${compact ? "gap-1.5" : "gap-2"}`}
      >
        {stats.week.map((day) => (
          <div
            key={day.key}
            className="grid justify-items-center gap-1"
            title={`${day.label}: ${day.isCompleted ? "є практика" : "ще немає практики"}`}
          >
            <span className="text-[10px] font-medium text-[#9aa8ba]">
              {day.label}
            </span>
            <span
              className={`size-3 rounded-full border transition ${
                day.isCompleted
                  ? "border-[#52e0c4] bg-[#2dd4bf] shadow-[0_0_0_3px_rgba(45,212,191,0.12)]"
                  : day.isToday
                    ? "border-[#52e0c4] bg-transparent"
                    : "border-[#3a4656] bg-[#121b27]"
              }`}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function getStreakVisual(count: number): {
  containerClass: string;
  icon: IconType;
  iconClass: string;
  title: string;
} {
  if (count >= 7) {
    return {
      containerClass: "bg-[#2d2110] text-[#ffb45f]",
      icon: Flame,
      iconClass: "fill-[#ff7a38]/40",
      title: "Сильна серія",
    };
  }

  if (count > 0) {
    return {
      containerClass: "bg-[#123129] text-[#52e0c4]",
      icon: Sparkles,
      iconClass: "",
      title: "Серія активна",
    };
  }

  return {
    containerClass: "bg-[#172232] text-[#9fb0c5]",
    icon: Target,
    iconClass: "",
    title: "Серія ще не почалась",
  };
}

export function MobileTopBar({
  activeView,
  currentViewLabel,
  isBusy,
  isOpen,
  onNavigate,
  onSignOut,
  onToggle,
  streakStats,
  userEmail,
}: {
  activeView: AppView;
  currentViewLabel: string;
  isBusy: boolean;
  isOpen: boolean;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
  onToggle: () => void;
  streakStats: StreakStats;
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
        <div className="absolute left-3 right-3 top-[calc(100%+0.5rem)]">
          <ShellPanel className="bg-[#10161f] p-3">
            <NavigationList activeView={activeView} onNavigate={onNavigate} />
            <StudyStreakWidget className="mt-3" compact stats={streakStats} />
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

function NavItem({
  icon: Icon,
  label,
  active = false,
  isCollapsed = false,
  onClick,
}: {
  icon: IconType;
  label: string;
  active?: boolean;
  isCollapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`flex w-full items-center rounded-lg text-sm font-medium transition ${
        isCollapsed ? "h-11 justify-center px-0" : "gap-3 px-3 py-2 text-left"
      } ${
        active
          ? "bg-[#14352f] text-[#52e0c4]"
          : "text-[#9aa8ba] hover:bg-[#151d28]"
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="size-4" />
      <span className={isCollapsed ? "sr-only" : ""}>{label}</span>
    </button>
  );
}
