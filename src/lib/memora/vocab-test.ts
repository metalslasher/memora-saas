/**
 * Vocabulary size test (placement), pure logic. Three layers:
 *
 * 1. Adaptive yes/no ("Do you know this word?") by frequency bands of 1,000
 *    lemmas (band 1 = ranks 1–1,000 … band 10 = 9,001–10,000), mixed with
 *    pseudowords that look English but do not exist. A block = 5 real words of
 *    one band + 2 pseudowords. Next band: +2 when the band is almost fully
 *    known (≥ 85 %), else +1; the test stops after two tested bands in a row
 *    below 35 % or after band 10.
 * 2. A check of part of the "yes" answers: the Ukrainian meaning out of 4
 *    (distractors are meanings of other words of the same band).
 * 3. Calibration by practice (see program-calibration.ts).
 *
 * Scoring:
 * - per band, the "correction for guessing" formula of yes/no tests
 *   p = (h − f) / (1 − f), where h = share of "yes" on real words of the band
 *   and f = share of "yes" on pseudowords (false alarms) over the whole test
 *   (Anderson & Freebody 1983; compared with other formulas — h − f, Δm,
 *   I_SDT — by Huibregtse, Admiraal & Meara 2002 and Mochida & Harrington
 *   2006, who found them close; cfg reads directly as "share of the band
 *   known"). The same yes/no design is used by Meara's EVST / X_Lex and by
 *   LexTALE (Lemhöfer & Broersma 2012);
 * - the meaning check corrects the "heard it somewhere" answers: the share
 *   of correct meanings c, corrected for guessing out of 4, c' = (c − ¼) / ¾,
 *   scales every band (needs at least 3 checks, else c' = 1);
 * - vocabulary = Σ p_b × 1,000 over the 10 bands; a skipped band takes the
 *   mean of its neighbours, bands after the stop count as 0 (conservative).
 */

export const BAND_SIZE = 1000;
export const BANDS = 10;
export const REAL_PER_BLOCK = 5;
export const PSEUDO_PER_BLOCK = 2;
export const SKIP_IF_ABOVE = 0.85;
export const STOP_IF_BELOW = 0.35;
export const MAX_CHECKS = 12;
export const CHECKS_PER_BAND = 2;
export const MIN_CHECKS_FOR_CORRECTION = 3;
export const TEST_VERSION = 1;

export type TestPool = {
  bands: Array<{ band: number; words: Array<{ word: string; uk: string; rank: number }> }>;
  pseudowords: string[];
};

export type Random = () => number;

export type YesNoItem =
  | { kind: "real"; word: string; band: number; rank: number }
  | { kind: "pseudo"; word: string };

export type TestState = {
  /** Bands asked, in order. */
  bands: number[];
  items: YesNoItem[];
  /** answers[i] belongs to items[i]; shorter while the block is in progress. */
  answers: boolean[];
  done: boolean;
};

export type CheckItem = { word: string; band: number; options: string[]; answer: number };

export type TestResult = {
  version: number;
  vocab: number;
  /** p per band 1…10 (index 0 = band 1), after both corrections. */
  bands: number[];
  falseAlarm: number;
  confirm: number;
  /** Real words answered "yes" and confirmed by the meaning check. */
  known: string[];
  /** Real words answered "no" or failed in the meaning check. */
  unknown: string[];
  takenAt: string;
};

function shuffle<T>(items: T[], random: Random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function blockFor(pool: TestPool, band: number, used: Set<string>, random: Random): YesNoItem[] {
  const bandWords = pool.bands.find((entry) => entry.band === band)?.words ?? [];
  const real = shuffle(bandWords.filter((word) => !used.has(word.word)), random)
    .slice(0, REAL_PER_BLOCK)
    .map((word): YesNoItem => ({ kind: "real", word: word.word, band, rank: word.rank }));
  const pseudo = shuffle(pool.pseudowords.filter((word) => !used.has(word)), random)
    .slice(0, PSEUDO_PER_BLOCK)
    .map((word): YesNoItem => ({ kind: "pseudo", word }));
  return shuffle([...real, ...pseudo], random);
}

export function startTest(pool: TestPool, random: Random = Math.random): TestState {
  return { bands: [1], items: blockFor(pool, 1, new Set(), random), answers: [], done: false };
}

export function blockFinished(state: TestState) {
  return state.answers.length >= state.items.length;
}

/** Share of "yes" on pseudowords so far. */
export function falseAlarmRate(state: TestState) {
  let total = 0;
  let yes = 0;
  state.items.forEach((item, index) => {
    if (item.kind !== "pseudo" || index >= state.answers.length) return;
    total += 1;
    if (state.answers[index]) yes += 1;
  });
  return total === 0 ? 0 : yes / total;
}

/** Correction for guessing: share of the band known, 0…1. */
export function correctedShare(hits: number, total: number, falseAlarm: number) {
  if (total === 0) return 0;
  const h = hits / total;
  if (falseAlarm >= 1) return 0;
  return Math.min(1, Math.max(0, (h - falseAlarm) / (1 - falseAlarm)));
}

/** Yes/no share per asked band (before the meaning check). */
export function bandShares(state: TestState) {
  const f = falseAlarmRate(state);
  return state.bands.map((band) => {
    let hits = 0;
    let total = 0;
    state.items.forEach((item, index) => {
      if (item.kind !== "real" || item.band !== band || index >= state.answers.length) return;
      total += 1;
      if (state.answers[index]) hits += 1;
    });
    return { band, hits, total, p: correctedShare(hits, total, f) };
  });
}

/**
 * Next band to ask, or null to stop. A band skipped after a jump is asked
 * after all when the band above it turns out not to be known (backfill).
 */
export function chooseNextBand(shares: Array<{ band: number; p: number }>): number | null {
  const byBand = [...shares].sort((a, b) => a.band - b.band);
  const top = byBand[byBand.length - 1];
  const below = byBand[byBand.length - 2];
  if (top.p < STOP_IF_BELOW && below && below.band === top.band - 1 && below.p < STOP_IF_BELOW) return null;
  const last = shares[shares.length - 1];
  const asked = new Set(shares.map((share) => share.band));
  if (last.band === top.band && last.p < SKIP_IF_ABOVE && last.band > 1 && !asked.has(last.band - 1)) {
    return last.band - 1;
  }
  const next = top.band + (top.p >= SKIP_IF_ABOVE && top.band + 2 <= BANDS ? 2 : 1);
  return next > BANDS ? null : next;
}

/** Records one answer; when the block is complete, adds the next one (or ends). */
export function answer(state: TestState, yes: boolean, pool: TestPool, random: Random = Math.random): TestState {
  if (state.done || blockFinished(state)) return state;
  const next = { ...state, answers: [...state.answers, yes] };
  if (!blockFinished(next)) return next;

  const nextBand = chooseNextBand(bandShares(next));
  if (nextBand === null) return { ...next, done: true };

  const used = new Set(next.items.map((item) => item.word));
  const block = blockFor(pool, nextBand, used, random);
  if (block.length === 0) return { ...next, done: true };
  return { ...next, bands: [...next.bands, nextBand], items: [...next.items, ...block] };
}

/** Meaning checks for part of the "yes" answers on real words. */
export function buildChecks(state: TestState, pool: TestPool, random: Random = Math.random): CheckItem[] {
  const byBand = new Map<number, Array<Extract<YesNoItem, { kind: "real" }>>>();
  state.items.forEach((item, index) => {
    if (item.kind !== "real" || !state.answers[index]) return;
    byBand.set(item.band, [...(byBand.get(item.band) ?? []), item]);
  });

  const picked = [...byBand.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, items]) => shuffle(items, random).slice(0, CHECKS_PER_BAND))
    .slice(0, MAX_CHECKS);

  const meaning = new Map(pool.bands.flatMap((band) => band.words.map((word) => [word.word, word.uk] as const)));
  return shuffle(picked, random).map((item) => {
    const correct = meaning.get(item.word) ?? "";
    const nearby = [0, -1, 1, -2, 2].flatMap(
      (offset) => pool.bands.find((band) => band.band === item.band + offset)?.words ?? [],
    );
    const distractors: string[] = [];
    for (const word of nearby) {
      if (distractors.length === 3) break;
      if (word.word === item.word || word.uk === correct || distractors.includes(word.uk)) continue;
      if (distractors.length < 3 && random() < 0.6) distractors.push(word.uk);
    }
    for (const word of nearby) {
      if (distractors.length === 3) break;
      if (word.word !== item.word && word.uk !== correct && !distractors.includes(word.uk)) distractors.push(word.uk);
    }
    const options = shuffle([correct, ...distractors], random);
    return { word: item.word, band: item.band, options, answer: options.indexOf(correct) };
  });
}

/** Share of correct meanings corrected for guessing out of 4. */
export function confirmationRate(correct: number, total: number) {
  if (total < MIN_CHECKS_FOR_CORRECTION) return 1;
  return Math.min(1, Math.max(0, (correct / total - 0.25) / 0.75));
}

export function scoreTest(
  state: TestState,
  checks: Array<{ word: string; correct: boolean }>,
  takenAt = new Date(),
): TestResult {
  const shares = bandShares(state);
  const correct = checks.filter((check) => check.correct).length;
  const confirm = confirmationRate(correct, checks.length);

  const measured = new Map(shares.map((share) => [share.band, share.p * confirm]));
  const lastBand = Math.max(...state.bands);
  const bands = Array.from({ length: BANDS }, (_, index) => {
    const band = index + 1;
    if (measured.has(band)) return measured.get(band)!;
    if (band > lastBand) return 0;
    const before = measured.get(band - 1);
    const after = measured.get(band + 1);
    if (before !== undefined && after !== undefined) return (before + after) / 2;
    return before ?? after ?? 0;
  });

  const failed = new Set(checks.filter((check) => !check.correct).map((check) => check.word));
  const confirmed = new Set(checks.filter((check) => check.correct).map((check) => check.word));
  const known: string[] = [];
  const unknown: string[] = [];
  state.items.forEach((item, index) => {
    if (item.kind !== "real" || index >= state.answers.length) return;
    if (!state.answers[index] || failed.has(item.word)) unknown.push(item.word);
    else if (confirmed.has(item.word)) known.push(item.word);
  });

  const vocab = Math.round(bands.reduce((sum, p) => sum + p * BAND_SIZE, 0) / 50) * 50;
  return {
    version: TEST_VERSION,
    vocab,
    bands: bands.map((p) => Math.round(p * 100) / 100),
    falseAlarm: Math.round(falseAlarmRate(state) * 100) / 100,
    confirm: Math.round(confirm * 100) / 100,
    known,
    unknown,
    takenAt: takenAt.toISOString(),
  };
}

/**
 * Orientation only: receptive vocabulary size → CEFR, after Milton (2010),
 * "The development of vocabulary breadth across the CEFR levels" (X_Lex,
 * 5,000 most frequent lemmas): A1 < 1,500, A2 < 2,500, B1 < 3,250,
 * B2 < 3,750, C1 < 4,500, above — C2.
 */
export function cefrFromVocab(vocab: number) {
  if (vocab < 1500) return "A1";
  if (vocab < 2500) return "A2";
  if (vocab < 3250) return "B1";
  if (vocab < 3750) return "B2";
  if (vocab < 4500) return "C1";
  return "C2";
}

/** Rough share of the test done, for the progress bar (bands asked so far). */
export function testProgress(state: TestState) {
  if (state.done) return 1;
  const answered = state.answers.length;
  const expected = Math.max(state.items.length + (REAL_PER_BLOCK + PSEUDO_PER_BLOCK) * 2, 1);
  return Math.min(0.95, answered / expected);
}

export function readTestResult(value: unknown): TestResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<TestResult>;
  if (typeof raw.vocab !== "number" || !Array.isArray(raw.bands)) return null;
  const words = (list: unknown) =>
    Array.isArray(list) ? list.filter((word): word is string => typeof word === "string") : [];
  return {
    version: typeof raw.version === "number" ? raw.version : TEST_VERSION,
    vocab: raw.vocab,
    bands: raw.bands.filter((p): p is number => typeof p === "number"),
    falseAlarm: typeof raw.falseAlarm === "number" ? raw.falseAlarm : 0,
    confirm: typeof raw.confirm === "number" ? raw.confirm : 1,
    known: words(raw.known),
    unknown: words(raw.unknown),
    takenAt: typeof raw.takenAt === "string" ? raw.takenAt : new Date(0).toISOString(),
  };
}
