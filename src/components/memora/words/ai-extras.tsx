import type { WordContent } from "@/lib/memora/types";

const frequencyLabels = { high: "часте", medium: "середньої частоти", low: "рідкісне" } as const;

/**
 * What AI added beyond the form fields: shown compactly under the form so the
 * learner sees the whole card before saving.
 */
export function AiExtras({ content, example }: { content: WordContent; example?: string }) {
  const [first, ...rest] = content.examples;
  const firstUk = first && first.en === example ? first.uk : undefined;
  const meta = [content.cefr, content.frequency ? frequencyLabels[content.frequency] : null].filter(Boolean);

  return (
    <div className="-mt-2 space-y-1.5 rounded-xl bg-surface-3/70 px-3 py-2.5 text-xs leading-5 text-text-2">
      {firstUk ? <p className="text-muted">{firstUk}</p> : null}
      {content.explanation ? (
        <p>
          {content.explanation}
          {meta.length > 0 ? <span className="text-faint"> · {meta.join(", ")}</span> : null}
        </p>
      ) : null}
      {rest.map((item) => (
        <p key={item.en}>
          <span className="text-text">{item.en}</span>
          {item.uk ? <span className="text-faint"> — {item.uk}</span> : null}
        </p>
      ))}
      {content.forms?.length ? <p className="text-faint">Форми: {content.forms.join(", ")}</p> : null}
      {content.synonyms?.length ? <p className="text-faint">Синоніми: {content.synonyms.join(", ")}</p> : null}
    </div>
  );
}
