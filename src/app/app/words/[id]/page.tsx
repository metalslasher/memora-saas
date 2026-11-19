import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WordDetailView } from "@/components/memora/words/word-detail-view";
import { getAppContext } from "@/lib/memora/data/context";
import { getWordDetail } from "@/lib/memora/data/words";
import { validateId } from "@/lib/memora/validation";

export const metadata: Metadata = { title: "Слово · Memora" };

export default async function WordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let wordId: string;
  try {
    wordId = validateId(id, "Слово");
  } catch {
    notFound();
  }

  const { supabase } = await getAppContext();
  const word = await getWordDetail(supabase, wordId);
  if (!word) notFound();
  const snapshot = crypto.randomUUID();

  return <WordDetailView key={snapshot} initialWord={word} snapshot={snapshot} />;
}
