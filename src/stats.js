/** Words per minute, using the standard 5 characters per word. */
export function wpm(chars, ms) {
  if (ms <= 0 || chars <= 0) return 0;
  return chars / 5 / (ms / 60000);
}

/** Accuracy in percent: correct keypresses / all keypresses. */
export function accuracy(correct, total) {
  return total ? (correct / total) * 100 : 100;
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
