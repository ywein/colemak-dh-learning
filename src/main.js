import { createKeyboard } from './keyboard.js';
import { LEVELS, clampLevel, levelInfo } from './levels.js';
import { generateLine, wordsIn } from './generator.js';
import { Session } from './session.js';
import { Training, aggregate, lineResult, topMissed } from './training.js';
import { wpm, accuracy } from './stats.js';
import { loadSettings, saveSettings, loadHistory, addSession, clearHistory } from './storage.js';
import { renderStatsPage } from './statsPage.js';
import { h, tile, missedList, formatDuration, pct, int } from './dom.js';

const RUN_OPTIONS = [5, 10, 20];

const $ = (id) => document.getElementById(id);
const keyboard = createKeyboard($('keyboard'));
const settings = loadSettings();

const state = {
  view: 'practice',
  level: clampLevel(settings.level),
  runs: RUN_OPTIONS.includes(settings.runs) ? settings.runs : 10,
  info: null,
  training: null,
  session: null, // the current line
  nextText: '',
  spans: [],
  lastLine: null, // result of the previous line, shown until the next one starts
  summary: false, // showing the end-of-session summary
};

const persist = () => saveSettings({ level: state.level, runs: state.runs });

// ---------- level / session setup ----------

function setLevel(level) {
  state.level = clampLevel(level);
  state.info = levelInfo(state.level);
  persist();
  keyboard.setEnabled(state.info.letters, state.info.fresh);
  renderLevel();
  startTraining();
}

function renderLevel() {
  $('level-num').textContent = state.level + 1;
  $('level-max').textContent = LEVELS.length;
  $('level-prev').disabled = state.level === 0;
  $('level-next').disabled = state.level === LEVELS.length - 1;
  $('level-letters').replaceChildren(
    ...state.info.order.map((c) => h('span', { class: state.info.fresh.has(c) ? 'fresh' : null }, c)),
  );
}

function startTraining() {
  state.training = new Training(state.info, state.runs);
  state.lastLine = null;
  state.nextText = '';
  showSummary(false);
  newLine();
}

// ---------- lines ----------

function newLine() {
  const text = state.nextText || generateLine(state.info);
  state.session = new Session(text);
  state.nextText = generateLine(state.info, wordsIn(text));
  renderLine();
  $('next-line').textContent = state.training.lines.length + 1 < state.training.target ? state.nextText : '';
  keyboard.setNext(state.session.expected);
  renderStats();
}

function renderLine() {
  state.spans = [...state.session.text].map((c) => h('span', { class: c === ' ' ? 'ch space' : 'ch' }, c));
  $('line').replaceChildren(...state.spans);
  state.spans.forEach((_, i) => refreshSpan(i));
}

function refreshSpan(i) {
  const s = state.spans[i];
  if (!s) return;
  const { pos, errorAt } = state.session;
  s.classList.toggle('done', i < pos);
  s.classList.toggle('current', i === pos);
  s.classList.toggle('error', errorAt.has(i));
}

function finishLine() {
  const result = lineResult(state.session);
  state.training.add(result);
  state.lastLine = result;
  if (state.training.done) finishTraining();
  else newLine();
}

function finishTraining() {
  const record = state.training.record();
  addSession(record);
  renderStats();
  renderSummary(record);
  showSummary(true);
}

// ---------- summary ----------

function showSummary(on) {
  state.summary = on;
  $('summary').hidden = !on;
  $('run').hidden = on;
  if (on) {
    keyboard.setNext(null);
  } else {
    keyboard.clearHeat();
  }
}

function renderSummary(record) {
  const canAdvance = state.level < LEVELS.length - 1;
  $('summary').replaceChildren(
    h('h2', {}, `Session complete · Level ${state.level + 1}`),
    h(
      'div',
      { class: 'tiles' },
      tile(int(record.wpm), 'wpm'),
      tile(int(record.bestLineWpm), 'best line'),
      tile(pct(record.acc), 'accuracy'),
      tile(String(record.errors), 'errors'),
      tile(formatDuration(record.ms), 'time'),
    ),
    h('h3', {}, 'Most missed'),
    missedList(topMissed(record.keys, 5)),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', class: 'primary', onclick: () => startTraining() }, 'Again ', h('kbd', {}, 'Enter')),
      canAdvance && h('button', { type: 'button', onclick: () => setLevel(state.level + 1) }, 'Next level →'),
      h('a', { href: '#stats', class: 'button' }, 'All stats'),
    ),
  );
  keyboard.setHeat(record.keys);
}

// ---------- live stats ----------

function renderStats() {
  const { session: sess, training } = state;
  // Session-so-far totals include the line being typed.
  const lines = sess?.started && !sess.done ? [...training.lines, lineResult(sess)] : training.lines;
  const total = aggregate(lines);
  let live = null;
  if (sess?.started && !sess.done) {
    if (sess.elapsed() > 1500) live = wpm(sess.timedChars, sess.elapsed());
  } else if (state.lastLine) {
    live = wpm(state.lastLine.chars, state.lastLine.ms);
  }

  $('stat-wpm').textContent = live != null ? Math.round(live) : '–';
  $('stat-avg').textContent = training.lines.length ? Math.round(aggregate(training.lines).wpm) : '–';
  $('stat-errors').textContent = total.errors;
  $('stat-acc').textContent = total.keypresses ? pct(accuracy(total.correct, total.keypresses)) : '–';
  const done = Math.min(training.lines.length + (state.summary ? 0 : 1), training.target);
  $('stat-lines').textContent = `${done}/${training.target}`;
  $('progress-bar').style.width = `${(training.lines.length / training.target) * 100}%`;
}

setInterval(() => {
  if (state.view === 'practice' && state.session?.started && !state.session.done) renderStats();
}, 250);

// ---------- views ----------

function setView() {
  state.view = location.hash === '#stats' ? 'stats' : 'practice';
  $('practice-view').hidden = state.view !== 'practice';
  $('stats-view').hidden = state.view !== 'stats';
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === state.view));
  if (state.view === 'stats') {
    state.session?.pause();
    renderStatsPage($('stats-view'), loadHistory(), {
      onReset: () => {
        clearHistory();
        setView();
      },
    });
  }
}

window.addEventListener('hashchange', setView);

// ---------- input ----------

const setPaused = (paused) => {
  $('paused').hidden = !paused;
};

window.addEventListener('keydown', (e) => {
  if (state.view !== 'practice') return;
  const shortcut = e.ctrlKey || e.metaKey;
  // Keep Space from scrolling, Tab from moving focus, / and ' from Firefox quick-find, Alt from the menu bar.
  if (!shortcut && (e.key.length === 1 || e.key === 'Tab' || e.key === 'Alt' || e.key === 'Enter')) e.preventDefault();
  if (e.repeat) return;

  if (state.summary) {
    keyboard.press(e.code, e.key.length === 1 ? e.key : null);
    if (e.key === 'Enter' || e.key === ' ') startTraining();
    return;
  }
  if (e.key === 'Escape') {
    keyboard.press(e.code, null);
    newLine(); // skip: the line isn't counted
    return;
  }
  if (shortcut || e.key.length !== 1) {
    keyboard.press(e.code, null); // modifiers etc.: neutral flash only
    return;
  }

  setPaused(false);
  const sess = state.session;
  const at = sess.pos;
  const ok = sess.press(e.key);
  keyboard.press(e.code, e.key, ok);
  if (ok === null) return;

  refreshSpan(at);
  refreshSpan(at + 1);
  if (sess.done) {
    finishLine();
  } else {
    keyboard.setNext(sess.expected);
    renderStats();
  }
});

window.addEventListener('keyup', (e) => {
  keyboard.release(e.code);
  if (e.key === 'Alt') e.preventDefault();
});

window.addEventListener('blur', () => {
  keyboard.releaseAll();
  if (state.session?.started && !state.session.done) {
    state.session.pause();
    setPaused(true);
  }
});

// ---------- controls ----------

for (const [id, delta] of [['level-prev', -1], ['level-next', 1]]) {
  $(id).addEventListener('click', (e) => {
    e.currentTarget.blur();
    setLevel(state.level + delta);
  });
}

$('runs').value = String(state.runs);
$('runs').addEventListener('change', (e) => {
  state.runs = Number(e.target.value);
  persist();
  e.target.blur();
  startTraining();
});

setLevel(state.level);
setView();
