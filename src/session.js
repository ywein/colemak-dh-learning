// Typing state for a single line. "Stop on error": a wrong key never advances the cursor.
export class Session {
  constructor(text) {
    this.text = text;
    this.pos = 0;
    this.keypresses = 0;
    this.errors = 0;
    this.errorAt = new Set(); // indices that were mistyped at least once
    this.missed = new Map(); // expected char -> times it was missed
    this.start = null;
    this.end = null;
    this.pausedAt = null;
  }

  get expected() {
    return this.text[this.pos];
  }

  get done() {
    return this.pos >= this.text.length;
  }

  get started() {
    return this.start !== null;
  }

  /** Returns true (correct), false (wrong), or null (line already finished). */
  press(char, now = performance.now()) {
    if (this.done) return null;
    if (this.start === null) this.start = now;
    if (this.pausedAt !== null) {
      this.start += now - this.pausedAt; // don't count time spent paused
      this.pausedAt = null;
    }
    this.keypresses++;
    const ok = char === this.expected;
    if (ok) {
      this.pos++;
      if (this.done) this.end = now;
    } else {
      this.errors++;
      this.errorAt.add(this.pos);
      this.missed.set(this.expected, (this.missed.get(this.expected) ?? 0) + 1);
    }
    return ok;
  }

  pause(now = performance.now()) {
    if (this.started && this.end === null && this.pausedAt === null) this.pausedAt = now;
  }

  elapsed(now = performance.now()) {
    if (this.start === null) return 0;
    return (this.end ?? this.pausedAt ?? now) - this.start;
  }

  /** Characters typed after the clock started (the first keypress isn't timed). */
  get timedChars() {
    return Math.max(0, this.pos - 1);
  }
}
