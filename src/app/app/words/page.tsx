import type { Metadata } from "next";
import { WordsWorkspace } from "@/components/memora/words/words-workspace";
import { getAiStatus } from "@/lib/memora/ai/service";
import { getAppContext } from "@/lib/memora/data/context";
import { listWords } from "@/lib/memora/data/words";

export const metadata: Metadata = { title: "Слова · Memora" };

// AI enrichment of a batch of words can take ~20–40 s.
export const maxDuration = 60;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WordsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const param = (name: string) => (typeof params[name] === "string" ? (params[name] as string) : null);
  // "Share → Memora" and the home-screen shortcut land here (see /app/share).
  const shared = { add: param("add"), text: param("text"), linkOnly: param("shared") === "link" };
  const { supabase } = await getAppContext();
  const [words, ai] = await Promise.all([listWords(supabase), getAiStatus()]);
  const snapshot = crypto.randomUUID();

  return <WordsWorkspace key={snapshot} ai={ai} initialWords={words} shared={shared} snapshot={snapshot} />;
}
