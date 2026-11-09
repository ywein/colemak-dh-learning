// A training session = a fixed number of lines. Lines, sessions and all-time stats share one
// shape ({chars, correct, keypresses, errors, ms, keys}), so they aggregate the same way.
import { wpm, accuracy } from './stats.js';

/** Stats for one line (or the typed part of an unfinished one). */
export function lineResult(session) {
  const keys = {};
  for (const c of session.text.slice(0, session.pos)) {
    keys[c] ??= [0, 0];
    keys[c][0]++; // times typed
  }
  for (const [c, n] of session.missed) {
    keys[c] ??= [0, 0];
    keys[c][1] += n; // times missed
  }
  return {
    chars: session.timedChars,
    correct: session.pos,
    keypresses: session.keypresses,
    errors: session.errors,
    ms: session.elapsed(),
    keys,
  };
}

export function mergeKeys(a, b) {
  const out = { ...a };
  for (const [c, [seen, missed]] of Object.entries(b ?? {})) {
    const [s0, m0] = out[c] ?? [0, 0];
    out[c] = [s0 + seen, m0 + missed];
  }
  return out;
}

/** Sum line results or session records into one, with derived wpm/accuracy. */
export function aggregate(items) {
  const sum = { chars: 0, correct: 0, keypresses: 0, errors: 0, ms: 0, keys: {} };
  for (const it of items) {
    sum.chars += it.chars;
    sum.correct += it.correct;
    sum.keypresses += it.keypresses;
    sum.errors += it.errors;
    sum.ms += it.ms;
    sum.keys = mergeKeys(sum.keys, it.keys);
  }
  return { ...sum, wpm: wpm(sum.chars, sum.ms), acc: accuracy(sum.correct, sum.keypresses) };
}

/** Session records grouped by level, lowest level first: Map(level -> records, oldest first). */
export function byLevel(history) {
  const groups = new Map();
  for (const r of history) {
    if (!groups.has(r.level)) groups.set(r.level, []);
    groups.get(r.level).push(r);
  }
  return new Map([...groups].sort(([a], [b]) => a - b));
}

/** Keys sorted by how often they were missed. */
export function topMissed(keys, n = 5) {
  return Object.entries(keys)
    .map(([char, [seen, missed]]) => ({ char, seen, missed, rate: missed / Math.max(1, seen + missed) }))
    .filter((k) => k.missed > 0)
    .sort((a, b) => b.missed - a.missed || b.rate - a.rate)
    .slice(0, n);
}

export class Training {
  constructor(info, target) {
    this.info = info;
    this.target = target;
    this.lines = [];
  }

  add(result) {
    this.lines.push(result);
  }

  get done() {
    return this.lines.length >= this.target;
  }

  /** The record saved to history when the session is complete. */
  record() {
    const total = aggregate(this.lines);
    return {
      date: new Date().toISOString(),
      level: this.info.level,
      letters: this.info.order.join(''),
      lines: this.lines.length,
      chars: total.chars,
      correct: total.correct,
      keypresses: total.keypresses,
      errors: total.errors,
      ms: Math.round(total.ms),
      wpm: total.wpm,
      acc: total.acc,
      bestLineWpm: Math.max(...this.lines.map((l) => wpm(l.chars, l.ms))),
      keys: total.keys,
    };
  }
}
