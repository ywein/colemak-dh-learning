// All-time stats, computed from the session history in localStorage.
import { LEVELS } from './levels.js';
import { aggregate, topMissed } from './training.js';
import { createKeyboard } from './keyboard.js';
import { lineChart } from './chart.js';
import { h, tile, missedList, formatDuration, pct, int } from './dom.js';

let chart = null;

export function renderStatsPage(root, history, { onReset }) {
  chart?.destroy();
  chart = null;

  if (!history.length) {
    root.replaceChildren(
      h('div', { class: 'empty' }, h('h2', {}, 'No sessions yet'), h('p', { class: 'muted' }, 'Finish a training session and your stats will show up here.')),
    );
    return;
  }

  const all = aggregate(history);
  const recent = aggregate(history.slice(-10));
  const best = Math.max(...history.map((r) => r.wpm));
  const lines = history.reduce((n, r) => n + r.lines, 0);

  const chartBox = h('div', {});
  const heatBox = h('div', { class: 'keyboard small' });

  root.replaceChildren(
    h(
      'div',
      { class: 'tiles' },
      tile(int(history.length), 'sessions'),
      tile(int(lines), 'lines'),
      tile(formatDuration(all.ms), 'practice time'),
      tile(int(recent.wpm), 'wpm (last 10)'),
      tile(int(best), 'best session wpm'),
      tile(pct(all.acc), 'accuracy'),
    ),

    h('section', { class: 'card' }, h('h3', {}, 'WPM per session'), chartBox),

    h(
      'section',
      { class: 'card' },
      h('h3', {}, 'Missed keys (all time)'),
      h('p', { class: 'muted small-print' }, 'Darker tint = higher miss rate. Percent on each key = misses ÷ attempts.'),
      h('div', { class: 'heat-row' }, heatBox, h('div', { class: 'heat-list' }, missedList(topMissed(all.keys, 10)))),
    ),

    h('section', { class: 'card' }, h('h3', {}, 'By level'), levelTable(history)),

    h('section', { class: 'card' }, h('h3', {}, 'Recent sessions'), recentTable(history)),

    h('div', { class: 'danger-zone' }, resetButton(onReset)),
  );

  const kb = createKeyboard(heatBox);
  kb.setHeat(all.keys);

  chart = lineChart(
    chartBox,
    history.map((r) => ({ y: r.wpm, r })),
    {
      label: 'Words per minute for each completed session, oldest to newest',
      format: (v) => `${Math.round(v)}`,
      tooltip: (p, i) => [
        `${Math.round(p.r.wpm)} wpm`,
        `Session ${i + 1} · Level ${p.r.level + 1}`,
        `${pct(p.r.acc)} accuracy · ${p.r.errors} errors`,
        new Date(p.r.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
      ],
    },
  );
}

function levelTable(history) {
  const byLevel = new Map();
  for (const r of history) byLevel.set(r.level, [...(byLevel.get(r.level) ?? []), r]);
  const rows = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, rs]) => {
      const agg = aggregate(rs);
      return h(
        'tr',
        {},
        h('td', { class: 'num' }, String(level + 1)),
        h('td', { class: 'mono' }, (LEVELS[level] ?? []).join(' ')),
        h('td', { class: 'num' }, String(rs.length)),
        h('td', { class: 'num' }, int(agg.wpm)),
        h('td', { class: 'num' }, int(Math.max(...rs.map((r) => r.wpm)))),
        h('td', { class: 'num' }, pct(agg.acc)),
        h('td', { class: 'num' }, formatDuration(agg.ms)),
      );
    });
  return table(['Level', 'Adds', 'Sessions', 'Avg wpm', 'Best wpm', 'Accuracy', 'Time'], rows);
}

function recentTable(history) {
  const rows = history
    .slice(-15)
    .reverse()
    .map((r) =>
      h(
        'tr',
        {},
        h('td', {}, new Date(r.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })),
        h('td', { class: 'num' }, String(r.level + 1)),
        h('td', { class: 'num' }, int(r.wpm)),
        h('td', { class: 'num' }, pct(r.acc)),
        h('td', { class: 'num' }, String(r.errors)),
        h('td', { class: 'num' }, String(r.lines)),
        h('td', { class: 'num' }, formatDuration(r.ms)),
      ),
    );
  return table(['Date', 'Level', 'Wpm', 'Accuracy', 'Errors', 'Lines', 'Time'], rows);
}

function table(headers, rows) {
  return h(
    'table',
    {},
    h('thead', {}, h('tr', {}, headers.map((t, i) => h('th', { class: i > 1 || t === 'Level' ? 'num' : null }, t)))),
    h('tbody', {}, rows),
  );
}

/** Two-step reset: first click arms it, second click within 4s wipes history. */
function resetButton(onReset) {
  let armed = null;
  const btn = h('button', { type: 'button', class: 'danger' }, 'Reset all stats');
  btn.addEventListener('click', () => {
    if (armed) {
      clearTimeout(armed);
      onReset();
      return;
    }
    btn.textContent = 'Click again to delete all stats';
    btn.classList.add('armed');
    armed = setTimeout(() => {
      armed = null;
      btn.textContent = 'Reset all stats';
      btn.classList.remove('armed');
    }, 4000);
  });
  return btn;
}
