// Minimal single-series SVG line chart with a crosshair tooltip (hover + arrow keys).
import { h } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const M = { top: 16, right: 48, bottom: 28, left: 40 };
const HEIGHT = 240;

function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Clean axis: a 1/2/5×10^k step giving ~4 ticks, and a max that's a multiple of it. */
function niceScale(v) {
  const raw = Math.max(v * 1.1, 10) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { step, max: Math.ceil((v * 1.1) / step) * step || step * 4 };
}

/**
 * @param {HTMLElement} root
 * @param {{y:number}[]} points
 * @param {{format:(y:number)=>string, tooltip:(p, i)=>string[], label:string}} opts
 */
export function lineChart(root, points, opts) {
  root.classList.add('chart');
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const svgHost = h('div', {});
  root.replaceChildren(svgHost, tip);

  let focus = -1;

  function draw() {
    const width = Math.max(320, root.clientWidth);
    const iw = width - M.left - M.right;
    const ih = HEIGHT - M.top - M.bottom;
    const { step: yStep, max: yMax } = niceScale(Math.max(...points.map((p) => p.y)));
    const n = points.length;
    const x = (i) => M.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => M.top + ih - (v / yMax) * ih;

    const svg = s('svg', { width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, role: 'img', tabindex: 0 });
    svg.setAttribute('aria-label', opts.label);

    // recessive grid + y ticks
    for (let v = 0; v <= yMax; v += yStep) {
      svg.append(s('line', { class: 'grid', x1: M.left, x2: M.left + iw, y1: y(v), y2: y(v) }));
      const label = s('text', { class: 'axis', x: M.left - 8, y: y(v) + 4, 'text-anchor': 'end' });
      label.textContent = Math.round(v);
      svg.append(label);
    }
    // x ticks: first, last, and a few between (session numbers)
    const xStep = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += xStep) addXTick(i);
    if ((n - 1) % xStep !== 0) addXTick(n - 1);
    function addXTick(i) {
      const t = s('text', { class: 'axis', x: x(i), y: HEIGHT - 8, 'text-anchor': 'middle' });
      t.textContent = i + 1;
      svg.append(t);
    }

    // area wash + line
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ');
    if (n > 1) {
      svg.append(s('path', { class: 'area', d: `${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` }));
      svg.append(s('path', { class: 'line', d }));
    }

    // end dot + end value label
    const last = points[n - 1];
    svg.append(s('circle', { class: 'dot', cx: x(n - 1), cy: y(last.y), r: 4 }));
    const endLabel = s('text', { class: 'end-label', x: x(n - 1) + 10, y: y(last.y) + 4 });
    endLabel.textContent = opts.format(last.y);
    svg.append(endLabel);

    // crosshair layer
    const hair = s('line', { class: 'hair', y1: M.top, y2: M.top + ih, visibility: 'hidden' });
    const focusDot = s('circle', { class: 'dot', r: 5, visibility: 'hidden' });
    svg.append(hair, focusDot);
    const hit = s('rect', { x: M.left - 10, y: 0, width: iw + 20, height: HEIGHT, fill: 'transparent' });
    svg.append(hit);

    function show(i) {
      focus = i;
      if (i < 0) {
        hair.setAttribute('visibility', 'hidden');
        focusDot.setAttribute('visibility', 'hidden');
        tip.hidden = true;
        return;
      }
      const px = x(i);
      const py = y(points[i].y);
      hair.setAttribute('x1', px);
      hair.setAttribute('x2', px);
      hair.setAttribute('visibility', 'visible');
      focusDot.setAttribute('cx', px);
      focusDot.setAttribute('cy', py);
      focusDot.setAttribute('visibility', 'visible');
      const [head, ...rest] = opts.tooltip(points[i], i);
      tip.replaceChildren(h('strong', {}, head), ...rest.map((r) => h('div', {}, r)));
      tip.hidden = false;
      const tw = tip.offsetWidth;
      tip.style.left = `${px + 12 + tw > width ? px - tw - 12 : px + 12}px`;
      tip.style.top = `${Math.max(0, py - tip.offsetHeight / 2)}px`;
    }

    hit.addEventListener('pointermove', (e) => {
      const box = svg.getBoundingClientRect();
      const px = e.clientX - box.left;
      const i = n === 1 ? 0 : Math.round(((px - M.left) / iw) * (n - 1));
      show(Math.max(0, Math.min(n - 1, i)));
    });
    hit.addEventListener('pointerleave', () => show(-1));
    svg.addEventListener('focus', () => show(focus < 0 ? n - 1 : focus));
    svg.addEventListener('blur', () => show(-1));
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(Math.max(0, focus - 1));
      else if (e.key === 'ArrowRight') show(Math.min(n - 1, focus + 1));
      else return;
      e.preventDefault();
      e.stopPropagation();
    });

    svgHost.replaceChildren(svg);
  }

  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(root);
  return { destroy: () => ro.disconnect() };
}
