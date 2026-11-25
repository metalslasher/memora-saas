import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PracticeWorkspace } from "@/components/memora/practice/practice-workspace";
import { getAppContext, loadPracticeSummary } from "@/lib/memora/data/context";
import { getPracticeSession, getPracticeSummary } from "@/lib/memora/data/practice";
import { runDailyFeed } from "@/lib/memora/data/program";

export const metadata: Metadata = { title: "Практика · Memora" };

export default async function PracticePage() {
  const { supabase, profile } = await getAppContext();
  let summary = await loadPracticeSummary();

  // A brand-new learner (no words yet) starts with the test; others get an offer.
  if (!profile.onboardedAt && summary.activeCards === 0) redirect("/app/onboarding");

  if (profile.onboardedAt) {
    const added = await runDailyFeed(supabase, profile, summary);
    if (added > 0) summary = await getPracticeSummary(supabase, profile.timezone);
  }

  const { cards } = await getPracticeSession(supabase, profile, 0, Promise.resolve(summary));
  const snapshot = crypto.randomUUID();

  return (
    <PracticeWorkspace
      key={snapshot}
      initialCards={cards}
      snapshot={snapshot}
      summary={summary}
      offerTest={!profile.onboardedAt}
    />
  );
}
