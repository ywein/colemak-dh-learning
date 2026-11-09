import { WORDS } from './words.js';

const MIN_REAL_POOL = 30; // below this many real words, mix in pseudo-words
const FRESH_WEIGHT = 3; // words containing newly introduced letters are this much likelier
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

const poolCache = new Map();
/** Real words made only of the given letters. */
export function wordPool(letters) {
  const key = [...letters].sort().join('');
  if (!poolCache.has(key)) {
    poolCache.set(key, WORDS.filter((w) => [...w].every((c) => letters.has(c))));
  }
  return poolCache.get(key);
}

function weightedPick(items, weightOf) {
  let total = 0;
  const weights = items.map((it) => (total += weightOf(it)));
  const r = Math.random() * total;
  return items[weights.findIndex((w) => w > r)] ?? items[items.length - 1];
}

const pick = (items) => items[Math.floor(Math.random() * items.length)];

/** A pronounceable fake word using only `letters`. */
export function pseudoWord(letters, minLen = 2, maxLen = 6) {
  const alphabet = [...letters];
  for (let attempt = 0; attempt < 20; attempt++) {
    let prev = START;
    let word = '';
    while (word.length < maxLen) {
      const row = bigrams.get(prev) ?? new Map();
      const options = alphabet.map((c) => [c, (row.get(c) ?? 0) + 0.1]);
      if (word.length >= minLen) options.push([END, (row.get(END) ?? 0) + 0.1]);
      const [c] = weightedPick(options, (o) => o[1]);
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
 */
export function generateLine(info, avoid = new Set()) {
  const alpha = new Set([...info.letters].filter((c) => /[a-z]/.test(c)));
  const pool = wordPool(alpha);
  const realChance = pool.length >= MIN_REAL_POOL ? 1 : Math.max(0.4, pool.length / MIN_REAL_POOL);
  const hasFresh = (w) => [...w].some((c) => info.fresh.has(c));

  const words = [];
  let length = 0;
  while (length < TARGET_LENGTH) {
    let word;
    if (pool.length && Math.random() < realChance) {
      for (let i = 0; i < 10; i++) {
        word = weightedPick(pool, (w) => frequencyWeight.get(w) * (hasFresh(w) ? FRESH_WEIGHT : 1));
        if (!words.includes(word) && !avoid.has(word)) break;
      }
    } else {
      word = pseudoWord(alpha);
    }
    words.push(word);
    length += word.length + 1;
  }
  return punctuate(words, info.letters);
}

function punctuate(words, letters) {
  const marks = [',', '.', ';'].filter((p) => letters.has(p));
  const slash = letters.has('/');
  let out = words[0];
  for (let i = 1; i < words.length; i++) {
    let sep = ' ';
    if (marks.length && Math.random() < 0.25) out += pick(marks);
    else if (slash && Math.random() < 0.1) sep = '/';
    out += sep + words[i];
  }
  if (letters.has('.') && Math.random() < 0.5) out += '.';
  return out;
}

/** The plain words in a line, for passing as `avoid` to the next one. */
export const wordsIn = (text) => new Set(text.split(/[^a-z]+/).filter(Boolean));
