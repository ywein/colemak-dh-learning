// Weak-key focus: per-key miss rates from recent practice, turned into word-generator weights.
// boost = (key's miss rate / your average miss rate) ^ STRENGTH, so a key you miss twice as
// often as average makes words containing it ~2.8x likelier.

const HALF_LIFE = 10; // sessions; older practice fades so the focus follows how you type now
const RECENT = 60; // sessions older than this are ignored (their weight would be < 2%)
const PRIOR = 20; // pseudo-attempts at the average miss rate: a key needs real evidence to stand out
const STRENGTH = 1.5; // how hard to push weak keys; 1 = proportional to the miss rate
const MAX_BOOST = 5;
const SHOW_FROM = 2; // boost at which a key is listed as a focus key in the UI

/**
 * Weight multipliers for keys missed more often than average.
 * @param {{keys: Object<string, [number, number]>}[]} records  oldest first, newest last
 *   (session records and/or line results: keys are { char: [typed, missed] })
 * @param {Set<string>} letters  keys that can appear in generated text
 * @returns {Map<string, number>} key -> boost in (1, MAX_BOOST]; keys at or below average are absent
 */
export function keyBoosts(records, letters) {
  const recent = records.slice(-RECENT);
  const tally = new Map(); // key -> [attempts, misses], recency-weighted
  let attempts = 0;
  let misses = 0;
  recent.forEach((record, i) => {
    const weight = 0.5 ** ((recent.length - 1 - i) / HALF_LIFE);
    for (const [c, [typed, missed]] of Object.entries(record.keys ?? {})) {
      if (!letters.has(c)) continue;
      const t = tally.get(c) ?? [0, 0];
      t[0] += weight * (typed + missed);
      t[1] += weight * missed;
      tally.set(c, t);
      attempts += weight * (typed + missed);
      misses += weight * missed;
    }
  });

  const boosts = new Map();
  if (!misses) return boosts;
  const average = misses / attempts;
  for (const [c, [a, m]] of tally) {
    const rate = (m + PRIOR * average) / (a + PRIOR);
    const boost = (rate / average) ** STRENGTH;
    if (boost > 1) boosts.set(c, Math.min(MAX_BOOST, boost));
  }
  return boosts;
}

/** The keys worth pointing out to the user, weakest first. */
export function focusKeys(boosts, n = 3) {
  return [...boosts]
    .filter(([, b]) => b >= SHOW_FROM)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([c]) => c);
}
