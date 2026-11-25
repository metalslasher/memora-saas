import { MAX_TEXT_LENGTH } from "./text-pick";

/**
 * Android "Share → Memora" (Web Share Target). A word or a short phrase opens
 * "Add word" prefilled; a longer text opens "From a text". Chrome shares a page
 * as its title plus a URL and selected text as the text plus a link to it, so
 * links are dropped and the page title is used only when nothing else came.
 */
export type SharedContent = { title?: string | null; text?: string | null; url?: string | null };

export type ShareTarget =
  | { kind: "word"; value: string }
  | { kind: "text"; value: string }
  | { kind: "link" }
  | { kind: "empty" };

/** Up to this many words without sentence punctuation is "a word or a phrase". */
const MAX_PHRASE_WORDS = 4;
const MAX_PHRASE_LENGTH = 60;

const urlPattern = /\bhttps?:\/\/\S+/gi;
const edgeQuotes = /^["'“”„«»‘’`]+|["'“”„«»‘’`]+$/g;

function clean(value: string | null | undefined) {
  return (value ?? "").replace(urlPattern, " ").replace(/\s+/g, " ").trim().replace(edgeQuotes, "").trim();
}

export function classifyShare({ title, text, url }: SharedContent): ShareTarget {
  const hadLink = Boolean(url?.trim()) || urlPattern.test(text ?? "");
  urlPattern.lastIndex = 0;
  let content = clean(text);
  if (!content && !hadLink) content = clean(title);
  if (!content) return hadLink ? { kind: "link" } : { kind: "empty" };

  const phrase = content.replace(/[\s.,!?;:…"'“”„«»‘’`]+$/u, "").replace(edgeQuotes, "").trim();
  const words = phrase.split(" ").filter(Boolean);
  const isPhrase =
    words.length > 0 &&
    words.length <= MAX_PHRASE_WORDS &&
    phrase.length <= MAX_PHRASE_LENGTH &&
    !/[.!?;:…]/u.test(phrase);
  if (isPhrase) return { kind: "word", value: phrase };
  return { kind: "text", value: content.slice(0, MAX_TEXT_LENGTH) };
}

/** Where the share lands inside the app. */
export function shareRedirectPath(target: ShareTarget) {
  const params = new URLSearchParams();
  if (target.kind === "word") params.set("add", target.value);
  else if (target.kind === "text") params.set("text", target.value);
  else if (target.kind === "link") params.set("shared", "link");
  const query = params.toString();
  return query ? `/app/words?${query}` : "/app/words";
}

/** A post-login return path is only ever a page inside the app. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/app") || value.startsWith("//")) return null;
  if (value.length > 8000) return null;
  return value;
}
