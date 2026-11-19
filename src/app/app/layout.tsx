import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/memora/app-shell";
import { getAppContext, loadPracticeSummary } from "@/lib/memora/data/context";
import { getStreak } from "@/lib/memora/data/progress";
import { heldBackNew } from "@/lib/memora/pace";

export const metadata: Metadata = {
  title: "Memora",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getAppContext();
  const [streak, summary, cookieStore] = await Promise.all([
    getStreak(supabase, profile.timezone),
    loadPracticeSummary(),
    cookies(),
  ]);
  const dueCount = summary.dueWords + summary.newReady - heldBackNew(summary, 0);

  return (
    <AppShell
      dueCount={dueCount}
      email={user.email ?? null}
      sidebarCollapsed={cookieStore.get("memora-sidebar")?.value === "1"}
      streak={streak}
      timezone={profile.timezone}
    >
      {children}
    </AppShell>
  );
}
