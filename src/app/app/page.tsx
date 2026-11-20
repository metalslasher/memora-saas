import type { Metadata } from "next";
import { PracticeWorkspace } from "@/components/memora/practice/practice-workspace";
import { getAppContext, loadPracticeSummary } from "@/lib/memora/data/context";
import { getPracticeSession } from "@/lib/memora/data/practice";

export const metadata: Metadata = { title: "Практика · Memora" };

export default async function PracticePage() {
  const { supabase, profile } = await getAppContext();
  const { cards, summary } = await getPracticeSession(supabase, profile.timezone, 0, loadPracticeSummary());
  const snapshot = crypto.randomUUID();

  return <PracticeWorkspace key={snapshot} initialCards={cards} snapshot={snapshot} summary={summary} />;
}
