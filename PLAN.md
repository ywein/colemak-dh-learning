# Colemak-DH Trainer for Kyria rev3 — Plan

A small static website for learning Colemak-DH on a Kyria rev3. It has no backend and no build step.

## 1. Tech choices

- **Plain HTML + CSS + vanilla JS (ES modules)**, with no framework and no dependencies.
- Run it with any static server (`npx serve` or `python -m http.server`). ES modules don't load over `file://`.
- The word list is bundled as a `.js` module, so the app makes no network requests.
- Settings and progress (current level, options) are saved in `localStorage`.

## 2. File structure

```
index.html          page skeleton: stats bar, word line, keyboard, level controls
styles.css          dark theme, key states (dim / next / pressed-ok / pressed-err)
src/
  main.js           wires everything together, handles keydown/keyup
  layout.js         Kyria geometry + Colemak-DH labels (pure data)
  keyboard.js       renders the keyboard, exposes setState(...)
  levels.js         letter unlock order + level definitions
  words.js          bundled English word list (~5–10k words, frequency-sorted)
  generator.js      builds lines from allowed letters (real words + pseudo-word fallback)
  session.js        typing state machine: cursor, errors, timing
  stats.js          WPM / accuracy math
```

## 3. Keyboard view (feature 1)

**Geometry (`layout.js`).** Each half has 25 positions: 3 rows × 6 columns plus 7 thumb positions, one of which is the encoder (`*`, rendered dark and inert). Every key is stored as data:

```js
{ id: 'L13', x: 3, y: 0.0, label: 'f', kind: 'letter', finger: 'middle' }
// kind: 'letter' | 'punct' | 'space' | 'mod' | 'knob'
```

The `x`/`y` values are in key units, with column stagger offsets taken from the screenshot (pinky lowest, middle highest, inner index slightly lower). The right half mirrors the left. Keys are rendered as absolutely positioned `<div>`s inside a scaled container, so the whole board scales with CSS.

**Colemak-DH mapping:**

```
Left                         Right
Tab  q  w  f  p  b           j  l  u  y  ;  '
Esc  a  r  s  t  g           m  n  e  i  o  Ent
Sft  z  x  c  d  v           k  h  ,  .  /  Sft
     thumbs: Space etc.      thumbs: Bksp etc.
```

The outer columns and thumbs (except Space) are `mod` keys. They are drawn for orientation and are never part of training. The thumb assignments are placeholders that you can edit in `layout.js`.

**Optional:** tint keys by finger so that finger assignment is easy to see.

## 4. Levels and word generation (features 2 & 3)

**Unlock order (`levels.js`).** The order starts on the home row and then adds letters by English frequency and finger ease:

| Level | Adds        | Total letters |
|------:|-------------|---------------|
| 1     | a s t n e i | 6             |
| 2     | r o         | 8 (home row done, except g/m) |
| 3     | h d         | 10            |
| 4     | l u         | 12            |
| 5     | c m         | 14            |
| 6     | p f         | 16            |
| 7     | w y         | 18            |
| 8     | g b         | 20            |
| 9     | v k         | 22            |
| 10    | x j q z     | 26            |
| 11    | , . ; /     | punctuation   |

- **Level selection:** a level picker in the UI, with ← / → buttons.
- **Auto-advance (later):** unlock the next level when the last N lines are all at ≥ target WPM and ≥ 95% accuracy.
- **Manual override (later):** click a key on the keyboard view to toggle it on or off, building a custom letter set.
- **Disabled letters** get the `.disabled` class, which applies low opacity and removes the label contrast (feature 3).

**Word generation (`generator.js`):**

1. **Filter.** Keep only the words in `words.js` whose letters all belong to the allowed set. Cache the result per letter set.
2. **Bias toward new letters.** Weight words that contain the letters introduced in the current level about 3× higher, so new keys get drilled.
3. **Avoid repeats.** Don't repeat a word within a line. Also avoid reusing words from the previous line when the pool allows it.
4. **Pseudo-word fallback.** Early levels have very few real words; with `e n t s` there are only about 15 (net, ten, nest, sent, tense, seen…). When the pool is smaller than about 40 words, the generator mixes in pronounceable pseudo-words. They come from a letter-bigram model that is trained once on the full word list. At generation time, the model is restricted to allowed letters and renormalized. This is the same idea keybr uses.
5. **Line length.** Each line is about 40–50 characters, roughly 8–10 words.

## 5. Typing session (features 4, 5, 6)

**Word line (feature 5).** The current line is rendered as `<span>`s, one per character, each with one of these states:

- `done` (bright)
- `error` (red; the character was mistyped at least once)
- `current` (underline or caret, slight pulse)
- `pending` (dim)

The next line is shown faintly underneath as a preview. Finishing a line loads the next one immediately.

**Input handling.** A `keydown` listener on `window` uses `event.key`, which is the character the OS actually produced. This works if your keyboard or OS already outputs Colemak-DH (see open question 1).

- Modifier keys, repeat events, and keys not in the layout are ignored.
- `preventDefault` is called on Space so the page doesn't scroll.
- **Error mode, default "stop on error":** a wrong key does not advance the cursor. It counts an error and marks that character red. Building correct muscle memory is what matters while learning. An option to switch to "advance anyway + Backspace to fix" comes later.

**Keyboard highlights (feature 6):**

- **Next key:** an accent outline and glow on the key for the expected character, including Space.
- **Pressed key:** on `keydown`, the physical key you hit flashes green if it was correct and red if it was wrong. The flash clears on `keyup`, with a timeout as a fallback.
- **Wrong key:** both keys are visible at once, the expected one glowing and the pressed one red. This shows you where your finger went versus where it should go.

**Stats (feature 4), shown in the top bar:**

- **WPM:** (correct characters ÷ 5) ÷ minutes. The timer starts at the first keypress of a line and stops when the line is complete. The bar shows live WPM for the current line and the average over the last 10 lines.
- **Errors:** the error count for the current line plus accuracy, where accuracy = correct ÷ total keypresses.
- **Session totals:** lines completed and overall accuracy.
- **Per-letter error counts:** kept in memory for now. They could later drive a heatmap on the keyboard or weight word generation toward weak letters.

## 6. Build order

1. `layout.js` + `keyboard.js`: render the static keyboard with labels and check it against the real board.
2. `levels.js` + the dimming of disabled keys, plus the level picker.
3. `words.js` + `generator.js`: real-word filtering only. Log the pool size for each level.
4. `session.js` + the word line rendering, plus keydown handling with stop-on-error.
5. Next-key and pressed-key highlighting.
6. `stats.js` + the stats bar.
7. Pseudo-word fallback for small pools.
8. Polish: persist the level in `localStorage`, a restart/skip-line hotkey (e.g. Esc), and a focus/pause state when the window loses focus.

**Later:** auto-advance, click-to-toggle letters, a per-letter weakness heatmap, an error-mode toggle, and finger colors.

## 7. Decisions (resolved)

1. Colemak-DH lives in the Kyria firmware, so `event.key` is used directly. No remapping needed.
2. Thumbs: Space on both inner thumbs; Win and Alt on both sides. The outer columns are Tab/Esc/Shift (left) and Bksp/Ctrl/Shift (right). There's no `'` on the base layer, so the punctuation level is `, . ; /`.
3. Stop on error is the default.
4. Level 1 starts with 6 letters: `a s t n e i` (99 real words in the bundled list, so no pseudo-words needed).

## 8. Sessions & stats (added)

- **Training session** = N lines (5 / 10 / 20, default 10). A progress bar and `line x/N` show where you are. `Esc` skips a line without counting it. Changing level or N restarts the session.
- **End-of-session summary:** WPM (total chars ÷ total time), best line, accuracy, errors, time, and the top 5 missed keys. The keyboard turns into a miss-rate heatmap. `Enter` starts another session.
- **History** is stored in `localStorage` (`colemak-dh-trainer:history`). Each completed session is saved as one record: totals plus per-key `[typed, missed]`.
- **Stats tab (`#stats`):** totals, a WPM-per-session chart (hover or arrow keys for details), an all-time miss heatmap with a top-10 list, a per-level table, recent sessions, and a two-click reset.
- **New files:** `src/storage.js`, `src/training.js` (aggregation), `src/statsPage.js`, `src/chart.js`, `src/dom.js`.

## 9. Per-level stats, key hint, weak-key focus (added)

- **Per-level stats:** the Stats tab has a level picker (`All · 1 … 11`; levels without sessions are disabled). A level view scopes every section (tiles, WPM chart, heatmap with locked keys dimmed, recent sessions) to that level and offers "Reset level N stats". The "All" view is the sum of the per-level totals (`byLevel()` in `training.js`), and the "By level" table links into each level. History storage is unchanged: records already carry `level`.
- **Key hint** (`Always on` / `Gradual (after 1s)` / `Off`, saved in settings): controls the next-key glow on the keyboard. Gradual hides it and shows it only after 1s without a keypress; any keypress hides it again.
- **Weak-key focus (`src/focus.js`):** per-key miss rates come from the last 60 sessions, each weighted by recency (half-life 10 sessions), plus the lines finished in the current session. Each rate is smoothed toward the average with 20 pseudo-attempts. A key missed more than average gets `boost = (rate / average)^1.5`, capped at 5. The generator multiplies a word's weight by the product of its letters' boosts (capped at 6 per word), on top of frequency and the new-letter bonus. Pseudo-words and punctuation choice use the same boosts. The worst keys (boost ≥ 2) are shown as "focus" next to the level letters.

## Running

```
python -m http.server 8642   # then open http://localhost:8642
```
