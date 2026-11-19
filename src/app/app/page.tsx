import type { Metadata } from "next";
import { PracticeWorkspace } from "@/components/memora/practice/practice-workspace";
import { getAppContext, loadPracticeSummary } from "@/lib/memora/data/context";
import { getPracticeQueue } from "@/lib/memora/data/practice";

export const metadata: Metadata = { title: "Практика · Memora" };

export default async function PracticePage() {
  const { supabase, profile } = await getAppContext();
  const [cards, summary] = await Promise.all([
    getPracticeQueue(supabase, profile.timezone),
    loadPracticeSummary(),
  ]);
  const snapshot = crypto.randomUUID();

  return (
    <PracticeWorkspace
      key={snapshot}
      initialCards={cards}
      reviewButtons={profile.settings.reviewButtons}
      snapshot={snapshot}
      summary={summary}
    />
  );
}
