import { BOARD, KEYS } from './layout.js';

const FLASH_FALLBACK_MS = 400; // clear a flash even if keyup never arrives

export function createKeyboard(root) {
  root.innerHTML = '';
  root.style.aspectRatio = `${BOARD.width} / ${BOARD.height}`;

  const byChar = new Map();
  const byCode = new Map();
  const charKeys = [];
  const pct = (v, total) => `${(v / total) * 100}%`;
  const add = (map, k, el) => map.set(k, [...(map.get(k) ?? []), el]);

  for (const key of KEYS) {
    const el = document.createElement('div');
    el.className = `key ${key.kind}`;
    if (key.accent) el.classList.add('accent');
    if (key.homing) el.classList.add('homing');
    if (key.finger) el.dataset.finger = key.finger;
    el.style.left = pct(key.x - BOARD.key / 2, BOARD.width);
    el.style.top = pct(key.y - BOARD.key / 2, BOARD.height);
    el.style.width = pct(BOARD.key, BOARD.width);
    el.style.height = pct(BOARD.key, BOARD.height);

    const label = document.createElement('span');
    label.textContent = key.kind === 'knob' ? '*' : key.label;
    el.append(label);
    root.append(el);

    if (key.char !== null) add(byChar, key.char, el);
    if (key.kind === 'letter' || key.kind === 'punct') charKeys.push([key.char, el]);
    for (const code of key.codes) add(byCode, code, el);
  }

  let nextEls = [];
  const pressed = new Map(); // event.code -> { els, timer }

  function release(code) {
    const p = pressed.get(code);
    if (!p) return;
    clearTimeout(p.timer);
    p.els.forEach((el) => el.classList.remove('pressed', 'ok', 'bad'));
    pressed.delete(code);
  }

  return {
    /** Dim keys outside `enabled`; mark newly introduced ones. */
    setEnabled(enabled, fresh = new Set()) {
      for (const [char, el] of charKeys) {
        el.classList.toggle('disabled', !enabled.has(char));
        el.classList.toggle('fresh', fresh.has(char));
      }
    },

    /** Highlight the key(s) for the next expected character. */
    setNext(char) {
      nextEls.forEach((el) => el.classList.remove('next'));
      nextEls = char == null ? [] : byChar.get(char) ?? [];
      nextEls.forEach((el) => el.classList.add('next'));
    },

    /** Flash the physical key. ok: true (correct), false (wrong), null (neutral). */
    press(code, char, ok = null) {
      release(code);
      const els = (char != null && byChar.get(char.toLowerCase())) || byCode.get(code) || [];
      if (!els.length) return;
      els.forEach((el) => {
        el.classList.add('pressed');
        if (ok === true) el.classList.add('ok');
        if (ok === false) el.classList.add('bad');
      });
      pressed.set(code, { els, timer: setTimeout(() => release(code), FLASH_FALLBACK_MS) });
    },

    release,

    /**
     * Miss-rate heatmap. keys: { char: [typed, missed] }. Each missed key gets a tint scaled
     * to the worst key, plus its miss % printed on the cap (so it's not color-only).
     */
    setHeat(keys) {
      this.clearHeat();
      const rates = Object.entries(keys)
        .filter(([, [, missed]]) => missed > 0)
        .map(([c, [seen, missed]]) => [c, missed / (seen + missed)]);
      const max = Math.max(...rates.map(([, r]) => r), 0);
      for (const [c, rate] of rates) {
        for (const el of byChar.get(c) ?? []) {
          el.classList.add('heat');
          el.style.setProperty('--heat', String(0.2 + 0.8 * (rate / max)));
          el.append(Object.assign(document.createElement('small'), { className: 'miss', textContent: `${Math.round(rate * 100)}%` }));
        }
      }
    },

    clearHeat() {
      root.querySelectorAll('.key.heat').forEach((el) => {
        el.classList.remove('heat');
        el.style.removeProperty('--heat');
        el.querySelector('.miss')?.remove();
      });
    },

    releaseAll() {
      [...pressed.keys()].forEach(release);
    },
  };
}
