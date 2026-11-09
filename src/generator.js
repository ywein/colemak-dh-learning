import { WORDS } from './words.js';

const MIN_REAL_POOL = 30; // below this many real words, mix in pseudo-words
const FRESH_WEIGHT = 3; // words containing newly introduced letters are this much likelier
const MAX_FOCUS_WEIGHT = 6; // cap on the weak-key boost for one word, so lines stay varied
const TARGET_LENGTH = 45; // characters per line (roughly)
const RANK_SCALE = 1500; // frequency weighting: rank 0 -> 1, rank 1500 -> 1/2, rank 7500 -> 1/6
const START = '^';
const END = '$';

// Letter bigram model trained on the word list, used to make pronounceable pseudo-words.
const bigrams = new Map();
for (const word of WORDS) {
  let prev = START;
  for (const c of [...word, END]) {
    const row = bigrams.get(prev) ?? new Map();
    row.set(c, (row.get(c) ?? 0) + 1);
    bigrams.set(prev, row);
    prev = c;
  }
}

// WORDS is frequency-ordered, so a word's index is its rank. Common words come up more
// often, but gently enough that rare words still appear.
const frequencyWeight = new Map(WORDS.map((w, rank) => [w, 1 / (1 + rank / RANK_SCALE)]));
const distinctLetters = new Map(WORDS.map((w) => [w, [...new Set(w)]]));

const poolCache = new Map();
/** Real words made only of the given letters. */
export function wordPool(letters) {
  const key = [...letters].sort().join('');
  if (!poolCache.has(key)) {
    poolCache.set(key, WORDS.filter((w) => [...w].every((c) => letters.has(c))));
  }
  return poolCache.get(key);
}

/** A function that picks from `items` with the given weights (cumulative sums + binary search). */
function sampler(items, weights) {
  let total = 0;
  const cumulative = weights.map((w) => (total += w));
  return () => {
    const r = Math.random() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    return items[lo];
  };
}

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const noBoost = () => 1;

/**
 * A pronounceable fake word using only `letters`.
 * @param {(c:string)=>number} boost  extra weight per letter (weak keys come up more often)
 */
export function pseudoWord(letters, boost = noBoost, minLen = 2, maxLen = 6) {
  const alphabet = [...letters];
  for (let attempt = 0; attempt < 20; attempt++) {
    let prev = START;
    let word = '';
    while (word.length < maxLen) {
      const row = bigrams.get(prev) ?? new Map();
      const options = alphabet.slice();
      const weights = alphabet.map((c) => ((row.get(c) ?? 0) + 0.1) * boost(c));
      if (word.length >= minLen) {
        options.push(END);
        weights.push((row.get(END) ?? 0) + 0.1);
      }
      const c = sampler(options, weights)();
      if (c === END) break;
      word += c;
      prev = c;
    }
    if (!/(.)\1\1/.test(word)) return word;
  }
  return Array.from({ length: minLen + 1 }, () => pick(alphabet)).join('');
}

/**
 * One line of practice text for a level.
 * @param {{letters:Set<string>, fresh:Set<string>}} info  from levelInfo()
 * @param {Set<string>} avoid  words to avoid (e.g. the previous line)
 * @param {Map<string, number>} boosts  weak keys -> weight multiplier, from keyBoosts()
 */
export function generateLine(info, avoid = new Set(), boosts = new Map()) {
  const alpha = new Set([...info.letters].filter((c) => /[a-z]/.test(c)));
  const pool = wordPool(alpha);
  const realChance = pool.length >= MIN_REAL_POOL ? 1 : Math.max(0.4, pool.length / MIN_REAL_POOL);
  const boost = (c) => boosts.get(c) ?? 1;

  // Weights are computed once per line: frequency x new-letter bonus x weak-key focus.
  const pickReal = sampler(
    pool,
    pool.map((w) => {
      let fresh = false;
      let focus = 1;
      for (const c of distinctLetters.get(w)) {
        fresh ||= info.fresh.has(c);
        focus *= boost(c);
      }
      return frequencyWeight.get(w) * (fresh ? FRESH_WEIGHT : 1) * Math.min(MAX_FOCUS_WEIGHT, focus);
    }),
  );

  const words = [];
  let length = 0;
  while (length < TARGET_LENGTH) {
    let word;
    if (pool.length && Math.random() < realChance) {
      for (let i = 0; i < 10; i++) {
        word = pickReal();
        if (!words.includes(word) && !avoid.has(word)) break;
      }
    } else {
      word = pseudoWord(alpha, boost);
    }
    words.push(word);
    length += word.length + 1;
  }
  return punctuate(words, info.letters, boost);
}

function punctuate(words, letters, boost) {
  const marks = [',', '.', ';'].filter((p) => letters.has(p));
  const pickMark = sampler(marks, marks.map(boost));
  const slash = letters.has('/');
  let out = words[0];
  for (let i = 1; i < words.length; i++) {
    let sep = ' ';
    if (marks.length && Math.random() < 0.25) out += pickMark();
    else if (slash && Math.random() < 0.1 * boost('/')) sep = '/';
    out += sep + words[i];
  }
  if (letters.has('.') && Math.random() < 0.5) out += '.';
  return out;
}

/** The plain words in a line, for passing as `avoid` to the next one. */
export const wordsIn = (text) => new Set(text.split(/[^a-z]+/).filter(Boolean));
