import type { Metadata } from "next";
import { WordsWorkspace } from "@/components/memora/words/words-workspace";
import { getAiStatus } from "@/lib/memora/ai/service";
import { getAppContext } from "@/lib/memora/data/context";
import { listWords } from "@/lib/memora/data/words";

export const metadata: Metadata = { title: "Слова · Memora" };

// AI enrichment of a batch of words can take ~20–40 s.
export const maxDuration = 60;

export default async function WordsPage() {
  const { supabase } = await getAppContext();
  const [words, ai] = await Promise.all([listWords(supabase), getAiStatus()]);
  const snapshot = crypto.randomUUID();

  return <WordsWorkspace key={snapshot} ai={ai} initialWords={words} snapshot={snapshot} />;
}
