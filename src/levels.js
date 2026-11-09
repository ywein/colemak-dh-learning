// Letter unlock order: home row first, then roughly by English frequency / finger ease.
export const LEVELS = [
  ['a', 's', 't', 'n', 'e', 'i'],
  ['r', 'o'],
  ['h', 'd'],
  ['l', 'u'],
  ['c', 'm'],
  ['p', 'f'],
  ['w', 'y'],
  ['g', 'b'],
  ['v', 'k'],
  ['x', 'j', 'q', 'z'],
  [',', '.', ';', '/'],
];

export const clampLevel = (level) =>
  Math.min(LEVELS.length - 1, Math.max(0, Number.isInteger(level) ? level : 0));

/** Everything a level needs: all enabled characters, the newly added ones, display order. */
export function levelInfo(level) {
  const order = LEVELS.slice(0, level + 1).flat();
  return {
    level,
    order,
    letters: new Set(order),
    // On level 1 everything is new; highlighting all of it would just be noise.
    fresh: level === 0 ? new Set() : new Set(LEVELS[level]),
  };
}
