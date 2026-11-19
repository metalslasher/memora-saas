import type { Metadata } from "next";
import { WordsWorkspace } from "@/components/memora/words/words-workspace";
import { getAppContext } from "@/lib/memora/data/context";
import { listWords } from "@/lib/memora/data/words";

export const metadata: Metadata = { title: "Слова · Memora" };

export default async function WordsPage() {
  const { supabase } = await getAppContext();
  const words = await listWords(supabase);
  const snapshot = crypto.randomUUID();

  return <WordsWorkspace key={snapshot} initialWords={words} snapshot={snapshot} />;
}
