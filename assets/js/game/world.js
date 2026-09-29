// World geometry: spawn anchors authored in the HTML (<span class="spawn">) are measured into
// document coordinates. Everything in the game lives in document space, so collision math is
// plain arithmetic and nothing calls getBoundingClientRect() per frame.
import { $$ } from './util.js';

export const view = {
  sx: 0, sy: 0,      // scroll offsets
  vw: 0, vh: 0,      // viewport size
  dw: 0, dh: 0,      // document size
  top: 64,           // fixed top bar height
};

const spawns = [];
const listeners = new Set();

export function initWorld() {
  for (const el of $$('.spawn')) {
    spawns.push({ el, type: el.dataset.spawn, data: { ...el.dataset }, x: 0, y: 0, active: false });
  }
  const remeasure = () => scheduleMeasure();
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  document.fonts?.ready?.then(remeasure);
  new ResizeObserver(remeasure).observe(document.getElementById('main'));
  document.addEventListener('toggle', remeasure, true);
  // Some anchors live inside .reveal elements, which slide 18px into place on first view.
  document.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform' && e.target instanceof Element && e.target.classList.contains('reveal')) remeasure();
  }, true);
  readView();
}

/** Cheap per-frame read: scroll offsets only (document size is cached by readView). */
export function readScroll() {
  view.sx = window.scrollX;
  view.sy = window.scrollY;
}

/** Full read, done on measure/resize: viewport and document size. */
export function readView() {
  view.sx = window.scrollX;
  view.sy = window.scrollY;
  view.vw = document.documentElement.clientWidth;
  view.vh = window.innerHeight;
  view.dw = document.documentElement.scrollWidth;
  view.dh = document.documentElement.scrollHeight;
  view.top = document.getElementById('topbar')?.offsetHeight || 64;
}

let pending = 0;
export function scheduleMeasure() {
  if (pending) return;
  pending = requestAnimationFrame(() => { pending = 0; measure(); });
}

export function measure() {
  readView();
  for (const s of spawns) {
    const active = s.el.offsetParent !== null;
    s.active = active;
    if (!active) continue;
    const r = s.el.getBoundingClientRect();
    s.x = r.left + view.sx;
    s.y = r.top + view.sy;
  }
  for (const fn of listeners) fn();
}

export function onMeasure(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const spawnsOf = (type) => spawns.filter((s) => s.type === type);
export const spawnOf = (type, key, value) => spawns.find((s) => s.type === type && (!key || s.data[key] === value));

/** Document rect of an element (for section bounds, grass patches, etc.). */
export function docRect(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + view.sx, y: r.top + view.sy, w: r.width, h: r.height };
}

export function onScreen(x, y, margin = 0) {
  return y > view.sy - margin && y < view.sy + view.vh + margin && x > view.sx - margin && x < view.sx + view.vw + margin;
}
