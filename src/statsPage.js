// All-time stats, computed from the session history in localStorage. Stats are kept per level;
// the "All levels" view is the sum of the per-level totals.
import { LEVELS, levelInfo } from './levels.js';
import { aggregate, byLevel, topMissed } from './training.js';
import { createKeyboard } from './keyboard.js';
import { lineChart } from './chart.js';
import { h, tile, missedList, formatDuration, pct, int } from './dom.js';

let chart = null;
let scope = 'all'; // 'all' or a level index; remembered while the page is open

export function renderStatsPage(root, history, { onReset }, focusPicker = false) {
  chart?.destroy();
  chart = null;

  if (!history.length) {
    root.replaceChildren(
      h('div', { class: 'empty' }, h('h2', {}, 'No sessions yet'), h('p', { class: 'muted' }, 'Finish a training session and your stats will show up here.')),
    );
    return;
  }

  const levels = byLevel(history);
  if (scope !== 'all' && !levels.has(scope)) scope = 'all';
  const select = (s) => {
    scope = s;
    renderStatsPage(root, history, { onReset }, true);
  };

  const perLevel = new Map([...levels].map(([level, rs]) => [level, aggregate(rs)]));
  const all = scope === 'all';
  const records = all ? history : levels.get(scope);
  const total = all ? aggregate([...perLevel.values()]) : perLevel.get(scope);
  const recent = aggregate(records.slice(-10));
  const best = Math.max(...records.map((r) => r.wpm));
  const lines = records.reduce((n, r) => n + r.lines, 0);

  const chartBox = h('div', {});
  const heatBox = h('div', { class: 'keyboard small' });

  root.replaceChildren(
    levelPicker(levels, select),

    h(
      'div',
      { class: 'tiles' },
      tile(int(records.length), 'sessions'),
      tile(int(lines), 'lines'),
      tile(formatDuration(total.ms), 'practice time'),
      tile(int(recent.wpm), 'wpm (last 10)'),
      tile(int(best), 'best session wpm'),
      tile(pct(total.acc), 'accuracy'),
    ),

    h('section', { class: 'card' }, h('h3', {}, all ? 'WPM per session' : `WPM per session · level ${scope + 1}`), chartBox),

    h(
      'section',
      { class: 'card' },
      h('h3', {}, all ? 'Missed keys (all levels)' : `Missed keys · level ${scope + 1}`),
      h('p', { class: 'muted small-print' }, 'Darker tint = higher miss rate. Percent on each key = misses ÷ attempts.'),
      h('div', { class: 'heat-row' }, heatBox, h('div', { class: 'heat-list' }, missedList(topMissed(total.keys, 10)))),
    ),

    all ? h('section', { class: 'card' }, h('h3', {}, 'By level'), levelTable(levels, perLevel, select)) : '',

    h('section', { class: 'card' }, h('h3', {}, 'Recent sessions'), recentTable(records)),

    h('div', { class: 'danger-zone' }, resetButton(all ? null : scope, onReset)),
  );

  const kb = createKeyboard(heatBox);
  if (!all) kb.setEnabled(levelInfo(scope).letters);
  kb.setHeat(total.keys);

  chart = lineChart(
    chartBox,
    records.map((r) => ({ y: r.wpm, r })),
    {
      label: `Words per minute for each completed session${all ? '' : ` on level ${scope + 1}`}, oldest to newest`,
      format: (v) => `${Math.round(v)}`,
      tooltip: (p, i) => [
        `${Math.round(p.r.wpm)} wpm`,
        `Session ${i + 1} · Level ${p.r.level + 1}`,
        `${pct(p.r.acc)} accuracy · ${p.r.errors} errors`,
        new Date(p.r.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
      ],
    },
  );

  if (focusPicker) root.querySelector('.scope [aria-pressed="true"]')?.focus();
}

/** "Level: All 1 2 3 …" toggle row. Levels without sessions are disabled. */
function levelPicker(levels, select) {
  const chip = (s, label, title) =>
    h(
      'button',
      {
        type: 'button',
        class: 'chip',
        title,
        'aria-pressed': String(scope === s),
        disabled: s !== 'all' && !levels.has(s),
        onclick: () => select(s),
      },
      label,
    );
  return h(
    'div',
    { class: 'scope', role: 'group', 'aria-label': 'Show stats for level' },
    h('span', { class: 'muted' }, 'Level'),
    chip('all', 'All'),
    LEVELS.map((adds, level) => chip(level, String(level + 1), `Level ${level + 1}: adds ${adds.join(' ')}`)),
    scope !== 'all' && h('span', { class: 'letters' }, levelInfo(scope).order.join('')),
  );
}

function levelTable(levels, perLevel, select) {
  const rows = [...levels].map(([level, rs]) => {
    const agg = perLevel.get(level);
    return h(
      'tr',
      {},
      h('td', { class: 'num' }, h('button', { type: 'button', class: 'link', onclick: () => select(level) }, String(level + 1))),
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

/** Two-step reset: first click arms it, second click within 4s wipes the stats (all, or one level's). */
function resetButton(level, onReset) {
  const label = level == null ? 'Reset all stats' : `Reset level ${level + 1} stats`;
  const confirm = level == null ? 'Click again to delete all stats' : `Click again to delete level ${level + 1} stats`;
  let armed = null;
  const btn = h('button', { type: 'button', class: 'danger' }, label);
  btn.addEventListener('click', () => {
    if (armed) {
      clearTimeout(armed);
      onReset(level);
      return;
    }
    btn.textContent = confirm;
    btn.classList.add('armed');
    armed = setTimeout(() => {
      armed = null;
      btn.textContent = label;
      btn.classList.remove('armed');
    }, 4000);
  });
  return btn;
}
