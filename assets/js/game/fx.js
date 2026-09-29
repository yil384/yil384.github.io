// Visual effects. World effects use document coordinates inside #world;
// screen effects (flash) are fixed to the viewport.
import { h, autoRemove, rand, reducedMotion } from './util.js';

let layer = null;
let stage = null;
let liveParticles = 0;
const MAX_PARTICLES = 160;

export function initFx() {
  layer = document.getElementById('world');
  stage = document.getElementById('stage');
}

function place(el, x, y) {
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  layer.append(el);
  return el;
}

/** Floating combat text. kind: dmg | crit | heal | mp | block | info | buddy | super | gold | xp */
export function text(x, y, str, kind = 'dmg') {
  if (!layer) return;
  const wrap = h('div', { class: 'fx-anchor' });
  const inner = h('span', { class: `fx-text fx-text--${kind}` }, str);
  inner.style.setProperty('--dx', `${rand(-14, 14)}px`);
  wrap.append(inner);
  place(wrap, x, y);
  inner.addEventListener('animationend', () => wrap.remove(), { once: true });
  setTimeout(() => wrap.remove(), 1600);
}

export function burst(x, y, color = '#f5c542', count = 10, spread = 46, size = 5) {
  if (!layer) return;
  if (reducedMotion()) count = Math.min(count, 4);
  count = Math.min(count, MAX_PARTICLES - liveParticles);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
    const d = spread * rand(0.45, 1);
    const wrap = h('div', { class: 'fx-anchor' });
    const p = h('span', { class: 'fx-particle' });
    p.style.setProperty('--px', `${Math.cos(a) * d}px`);
    p.style.setProperty('--py', `${Math.sin(a) * d}px`);
    p.style.background = color;
    p.style.width = p.style.height = `${size}px`;
    p.style.animationDelay = `${rand(0, 0.06)}s`;
    wrap.append(p);
    place(wrap, x, y);
    liveParticles++;
    const done = () => { if (wrap.isConnected) { wrap.remove(); liveParticles--; } };
    p.addEventListener('animationend', done, { once: true });
    setTimeout(done, 1200);
  }
}

export function ring(x, y, color = '#f5c542', size = 60, cls = '') {
  if (!layer) return;
  const wrap = h('div', { class: 'fx-anchor' });
  const r = h('span', { class: `fx-ring ${cls}` });
  r.style.setProperty('--c', color);
  r.style.width = r.style.height = `${size}px`;
  wrap.append(r);
  place(wrap, x, y);
  r.addEventListener('animationend', () => wrap.remove(), { once: true });
  setTimeout(() => wrap.remove(), 1200);
}

export function beam(x1, y1, x2, y2, cls = 'fx-beam--laser', ms = 320) {
  if (!layer) return;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const b = h('div', { class: `fx-beam ${cls}` });
  b.style.width = `${len}px`;
  b.style.transform = `translate3d(${x1}px, ${y1}px, 0) rotate(${ang}rad)`;
  layer.append(b);
  setTimeout(() => b.remove(), ms);
}

/** Zig-zag lightning bolt from above the viewport down to (x, y). */
export function bolt(x, y, color = '#93c5fd') {
  if (!layer) return;
  const top = window.scrollY - 20;
  const hgt = Math.max(40, y - top);
  const segs = 7;
  let d = `M ${rand(-12, 12)} 0`;
  for (let i = 1; i < segs; i++) d += ` L ${rand(-22, 22)} ${(hgt / segs) * i}`;
  d += ` L 0 ${hgt}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'fx-bolt');
  svg.setAttribute('width', '60');
  svg.setAttribute('height', String(hgt));
  svg.setAttribute('viewBox', `-30 0 60 ${hgt}`);
  svg.style.transform = `translate3d(${x - 30}px, ${top}px, 0)`;
  svg.style.color = color;
  svg.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="1"/>`;
  layer.append(svg);
  setTimeout(() => svg.remove(), 280);
}

export function flash(color = 'rgba(255,255,255,0.35)') {
  if (reducedMotion()) return;
  const f = h('div', { class: 'fx-flash' });
  f.style.background = color;
  document.body.append(f);
  autoRemove(f, 600);
}

let shakeUntil = 0;
let shakePower = 0;
let shakeRaf = 0;
export function shake(power = 6, ms = 220) {
  if (!stage || reducedMotion()) return;
  const now = performance.now();
  shakeUntil = Math.max(shakeUntil, now + ms);
  shakePower = Math.max(shakePower, power);
  if (shakeRaf) return;
  const step = () => {
    const t = performance.now();
    if (t >= shakeUntil) {
      stage.style.transform = '';
      shakePower = 0;
      shakeRaf = 0;
      return;
    }
    const k = shakePower * ((shakeUntil - t) / ms);
    stage.style.transform = `translate3d(${rand(-k, k)}px, ${rand(-k, k)}px, 0)`;
    shakeRaf = requestAnimationFrame(step);
  };
  shakeRaf = requestAnimationFrame(step);
}

export function confetti(x, y, count = 40) {
  const colors = ['#f5c542', '#f87171', '#4ade80', '#8b93ff', '#60a5fa', '#fb923c', '#f472b6', '#5ee1e6'];
  for (let i = 0; i < Math.min(count, reducedMotion() ? 8 : count); i++) {
    burst(x + rand(-30, 30), y + rand(-20, 20), colors[i % colors.length], 1, rand(90, 220), rand(5, 9));
  }
}

/** A world-space element that the caller moves and removes (projectiles, hazards). */
export function worldEl(cls, x, y) {
  const el = h('div', { class: cls });
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  layer.append(el);
  return el;
}
