// Kyria rev3 geometry + Colemak-DH labels. Pure data.
// Coordinates are key centers in "board pixels" (taken from a layout screenshot);
// the keyboard view scales them to whatever width it is rendered at.

export const BOARD = { width: 1050, height: 330, key: 54 };

const MIRROR = 1048; // x of the right half = MIRROR - x of the left half
const ROW_STEP = 64;

// Left half columns, outer -> inner: [centerX, topRowCenterY] (column stagger)
const LEFT_COLS = [[28, 76], [92, 76], [157, 44], [221, 30], [285, 44], [348, 60]];
const LEFT_FINGERS = ['pinky', 'pinky', 'ring', 'middle', 'index', 'index'];
const LEFT_GRID = [
  ['Tab', 'q', 'w', 'f', 'p', 'b'],
  ['Esc', 'a', 'r', 's', 't', 'g'],
  ['Shift', 'z', 'x', 'c', 'd', 'v'],
];

// Right half columns, inner -> outer (mirror of the left half)
const RIGHT_FINGERS = ['index', 'index', 'middle', 'ring', 'pinky', 'pinky'];
const RIGHT_GRID = [
  ['j', 'l', 'u', 'y', ';', 'Bksp'],
  ['m', 'n', 'e', 'i', 'o', 'Ctrl'],
  ['k', 'h', ',', '.', '/', 'Shift'],
];

// Modifier label -> KeyboardEvent.code, per side
const MOD_CODES = {
  left: { Tab: 'Tab', Esc: 'Escape', Shift: 'ShiftLeft', Win: 'MetaLeft', Alt: 'AltLeft' },
  right: { Bksp: 'Backspace', Ctrl: 'ControlRight', Shift: 'ShiftRight', Win: 'MetaRight', Alt: 'AltRight' },
};
const ACCENT = new Set(['Esc', 'Win']);
const HOMING = new Set(['t', 'n']);

// Left thumb cluster; the right one is its mirror. Blank labels = unassigned keys.
const LEFT_THUMBS = [
  { x: 189, y: 236, label: '' },
  { x: 246, y: 236, label: 'Win' },
  { x: 318, y: 252, label: 'Alt' },
  { x: 408, y: 215, label: '' },
  { x: 476, y: 236, label: '', kind: 'knob' },
  { x: 380, y: 284, label: 'Space', kind: 'space' },
  { x: 446, y: 300, label: '' },
];

function makeKey(side, id, x, y, label, finger, kind) {
  const key = {
    id, x, y, label, finger,
    kind: kind ?? 'mod',
    char: null,
    codes: [],
    accent: ACCENT.has(label),
    homing: HOMING.has(label),
  };
  if (!kind && label.length === 1) {
    key.kind = /[a-z]/.test(label) ? 'letter' : 'punct';
    key.char = label;
  } else if (key.kind === 'space') {
    key.char = ' ';
    key.codes = ['Space'];
  } else if (MOD_CODES[side][label]) {
    key.codes = [MOD_CODES[side][label]];
  } else if (!label && key.kind === 'mod') {
    key.kind = 'blank'; // unassigned key
  }
  return key;
}

function buildKeys() {
  const keys = [];
  LEFT_GRID.forEach((row, r) => row.forEach((label, c) => {
    const [x, y] = LEFT_COLS[c];
    keys.push(makeKey('left', `L${r}${c}`, x, y + r * ROW_STEP, label, LEFT_FINGERS[c]));
  }));
  RIGHT_GRID.forEach((row, r) => row.forEach((label, c) => {
    const [x, y] = LEFT_COLS[5 - c];
    keys.push(makeKey('right', `R${r}${c}`, MIRROR - x, y + r * ROW_STEP, label, RIGHT_FINGERS[c]));
  }));
  LEFT_THUMBS.forEach((t, i) => {
    keys.push(makeKey('left', `LT${i}`, t.x, t.y, t.label, 'thumb', t.kind));
    keys.push(makeKey('right', `RT${i}`, MIRROR - t.x, t.y, t.label, 'thumb', t.kind));
  });
  return keys;
}

export const KEYS = buildKeys();
