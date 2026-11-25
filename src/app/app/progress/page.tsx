import type { Metadata } from "next";
import { ProgressView } from "@/components/memora/progress-view";
import { getAppContext } from "@/lib/memora/data/context";
import { getProgressStats, listRecentReviews, listWeakCards } from "@/lib/memora/data/progress";

export const metadata: Metadata = { title: "Прогрес · Memora" };

export default async function ProgressPage() {
  const { supabase, profile } = await getAppContext();
  const [stats, weakCards, recentReviews] = await Promise.all([
    getProgressStats(supabase, profile),
    listWeakCards(supabase),
    listRecentReviews(supabase),
  ]);

  return <ProgressView recentReviews={recentReviews} stats={stats} weakCards={weakCards} />;
}
