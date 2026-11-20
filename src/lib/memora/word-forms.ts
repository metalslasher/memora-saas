/**
 * English word forms for answer checking and cloze detection: regular
 * -s/-es/-ed/-ing endings (with the usual spelling rules) plus a small table
 * of common irregular verbs. Deliberately simple: it may generate a few
 * non-words ("goed"), which is harmless because forms are only compared
 * against text, never shown.
 */

// base: [past, past participle]
const irregularVerbs: Record<string, [string, string]> = {
  be: ["was", "been"],
  become: ["became", "become"],
  begin: ["began", "begun"],
  bite: ["bit", "bitten"],
  break: ["broke", "broken"],
  bring: ["brought", "brought"],
  build: ["built", "built"],
  buy: ["bought", "bought"],
  catch: ["caught", "caught"],
  choose: ["chose", "chosen"],
  come: ["came", "come"],
  cost: ["cost", "cost"],
  cut: ["cut", "cut"],
  deal: ["dealt", "dealt"],
  do: ["did", "done"],
  draw: ["drew", "drawn"],
  drink: ["drank", "drunk"],
  drive: ["drove", "driven"],
  eat: ["ate", "eaten"],
  fall: ["fell", "fallen"],
  feed: ["fed", "fed"],
  feel: ["felt", "felt"],
  fight: ["fought", "fought"],
  find: ["found", "found"],
  fly: ["flew", "flown"],
  forget: ["forgot", "forgotten"],
  get: ["got", "gotten"],
  give: ["gave", "given"],
  go: ["went", "gone"],
  grow: ["grew", "grown"],
  hang: ["hung", "hung"],
  have: ["had", "had"],
  hear: ["heard", "heard"],
  hide: ["hid", "hidden"],
  hit: ["hit", "hit"],
  hold: ["held", "held"],
  hurt: ["hurt", "hurt"],
  keep: ["kept", "kept"],
  know: ["knew", "known"],
  lay: ["laid", "laid"],
  lead: ["led", "led"],
  leave: ["left", "left"],
  lend: ["lent", "lent"],
  let: ["let", "let"],
  lie: ["lay", "lain"],
  light: ["lit", "lit"],
  lose: ["lost", "lost"],
  make: ["made", "made"],
  mean: ["meant", "meant"],
  meet: ["met", "met"],
  pay: ["paid", "paid"],
  put: ["put", "put"],
  quit: ["quit", "quit"],
  read: ["read", "read"],
  ride: ["rode", "ridden"],
  ring: ["rang", "rung"],
  rise: ["rose", "risen"],
  run: ["ran", "run"],
  say: ["said", "said"],
  see: ["saw", "seen"],
  seek: ["sought", "sought"],
  sell: ["sold", "sold"],
  send: ["sent", "sent"],
  set: ["set", "set"],
  shake: ["shook", "shaken"],
  shoot: ["shot", "shot"],
  show: ["showed", "shown"],
  shut: ["shut", "shut"],
  sing: ["sang", "sung"],
  sink: ["sank", "sunk"],
  sit: ["sat", "sat"],
  sleep: ["slept", "slept"],
  speak: ["spoke", "spoken"],
  spend: ["spent", "spent"],
  stand: ["stood", "stood"],
  steal: ["stole", "stolen"],
  stick: ["stuck", "stuck"],
  swim: ["swam", "swum"],
  take: ["took", "taken"],
  teach: ["taught", "taught"],
  tear: ["tore", "torn"],
  tell: ["told", "told"],
  think: ["thought", "thought"],
  throw: ["threw", "thrown"],
  understand: ["understood", "understood"],
  wake: ["woke", "woken"],
  wear: ["wore", "worn"],
  win: ["won", "won"],
  write: ["wrote", "written"],
};

const extraForms: Record<string, string[]> = {
  be: ["am", "is", "are", "were", "being"],
  have: ["has"],
  do: ["does"],
  go: ["goes"],
  get: ["got"],
};

const vowels = new Set(["a", "e", "i", "o", "u"]);

function isConsonant(char: string | undefined) {
  return Boolean(char) && /[a-z]/.test(char!) && !vowels.has(char!);
}

/** Short consonant-vowel-consonant words double the last letter: stop → stopped. */
function doublesFinal(word: string) {
  if (word.length < 3 || word.length > 4) return false;
  const [a, b, c] = word.slice(-3);
  return isConsonant(a) && vowels.has(b) && isConsonant(c) && !"wxy".includes(c);
}

/** All forms of a single English word, including the word itself. */
export function wordForms(word: string): Set<string> {
  const base = word.toLowerCase();
  const forms = new Set<string>([base]);
  if (!/^[a-z]+$/.test(base)) return forms;

  // -s / -es
  if (/(s|x|z|ch|sh|o)$/.test(base)) forms.add(`${base}es`);
  else if (/[^aeiou]y$/.test(base)) forms.add(`${base.slice(0, -1)}ies`);
  else forms.add(`${base}s`);

  // -ed
  if (base.endsWith("e")) forms.add(`${base}d`);
  else if (/[^aeiou]y$/.test(base)) forms.add(`${base.slice(0, -1)}ied`);
  else forms.add(`${base}ed`);

  // -ing
  if (base.endsWith("ie")) forms.add(`${base.slice(0, -2)}ying`);
  else if (base.endsWith("e") && !base.endsWith("ee") && base.length > 2) forms.add(`${base.slice(0, -1)}ing`);
  else forms.add(`${base}ing`);

  if (doublesFinal(base)) {
    const last = base.at(-1);
    forms.add(`${base}${last}ed`);
    forms.add(`${base}${last}ing`);
  }

  const irregular = irregularVerbs[base];
  if (irregular) irregular.forEach((form) => forms.add(form));
  extraForms[base]?.forEach((form) => forms.add(form));

  return forms;
}

/**
 * Forms of a word or phrase. In a phrase the first word is the one that
 * usually changes ("look forward to" → "looking forward to"); for nouns the
 * last one does ("credit card" → "credit cards"). Both are covered.
 */
export function phraseForms(phrase: string): Set<string> {
  const tokens = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return new Set();
  if (tokens.length === 1) return wordForms(tokens[0]);

  const forms = new Set<string>([tokens.join(" ")]);
  const rest = tokens.slice(1).join(" ");
  for (const form of wordForms(tokens[0])) forms.add(`${form} ${rest}`);
  const head = tokens.slice(0, -1).join(" ");
  for (const form of wordForms(tokens.at(-1)!)) forms.add(`${head} ${form}`);
  return forms;
}

/** True when both strings are forms of the same word or phrase. */
export function isSameLemma(a: string, b: string) {
  if (a === b) return true;
  return phraseForms(b).has(a) || phraseForms(a).has(b);
}
