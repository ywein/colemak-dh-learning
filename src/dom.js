/** Tiny element builder. Strings become text nodes (never parsed as HTML). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

export const keyName = (c) => (c === ' ' ? 'Space' : c);

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export const pct = (x) => `${Math.round(x)}%`;
export const int = (x) => String(Math.round(x));

/** A big-number tile: value on top, label below. */
export const tile = (value, label) =>
  h('div', { class: 'tile' }, h('span', { class: 'v' }, value), h('span', { class: 'l' }, label));

/** "e  4 misses · 8%" chips for the most-missed keys. */
export function missedList(missed) {
  if (!missed.length) return h('p', { class: 'muted' }, 'No missed keys. Clean run!');
  return h(
    'ol',
    { class: 'missed' },
    missed.map((k) =>
      h(
        'li',
        {},
        h('kbd', {}, keyName(k.char)),
        h('span', { class: 'count' }, `${k.missed} miss${k.missed === 1 ? '' : 'es'}`),
        h('span', { class: 'muted' }, pct(k.rate * 100)),
      ),
    ),
  );
}
