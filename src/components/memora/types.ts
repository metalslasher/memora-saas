import { BarChart3, CircleHelp, Languages, Target, UserCircle } from "lucide-react";

export type IconType = typeof Target;

export type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  /** Shown in the mobile bottom tab bar. */
  inTabBar: boolean;
};

export const navigationItems: NavItem[] = [
  { href: "/app", label: "Практика", icon: Target, inTabBar: true },
  { href: "/app/words", label: "Слова", icon: Languages, inTabBar: true },
  { href: "/app/progress", label: "Прогрес", icon: BarChart3, inTabBar: true },
  { href: "/app/settings", label: "Профіль", icon: UserCircle, inTabBar: true },
  { href: "/app/help", label: "Довідка", icon: CircleHelp, inTabBar: false },
];

export function isNavActive(href: string, pathname: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function sectionTitle(pathname: string) {
  return navigationItems.find((item) => isNavActive(item.href, pathname))?.label ?? "Memora";
}
