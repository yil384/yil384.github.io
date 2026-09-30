// Walk mode (SPEC §2.11): the successor of the original homepage's movable pixel character. Press P
// (or "Walk the page" in the title menu) and the scholar hops out onto the page: ←/→ walk, Space/↑
// jump (a second press in the air double-jumps), ↓ drops through a ledge, Esc or P stops. Ledges are
// the top edges of the big name, every card, every item row and the trail strips between chapters.
// Landing on a row lights it (and its landmark in the 3D world); Bit comes over. Tokens are picked up
// by touching them, critters are bonked by landing on them. On touch screens: tap a row and the scholar
// hops there. Everything is measured on entry / resize / layout changes; the rAF loop runs only while
// the scholar is actually moving, and only in walk mode.
/* global getComputedStyle, scrollX, removeEventListener */
import { registerEgg } from '../eggs.js';
import { registerKey } from './keys.js';
import { frameUrls, speak } from './bit.js';
import { critters } from './critters.js';
import { $, $$, h, on, emit, found, world, rm, isGame, isPlain, isEditable, sfx, float, live, burst } from './kit.js';

const SPEED = 180;          // px/s
const JUMP_H = 100;         // px
const JUMP_T = 0.45;        // s, full arc back to the same height
const G = (8 * JUMP_H) / (JUMP_T * JUMP_T);
const V0 = (4 * JUMP_H) / JUMP_T;
const W = 36, H = 48;       // sprite box (scholar 12×16 at 3×)

const html = document.documentElement;
let active = false;
let layer = null, walker = null, face = null, img = null, chip = null;
let frames = [];
let plats = [], tokens = [];
let x = 0, y = 0, vx = 0, vy = 0, ground = null, facing = 1, airJumps = 1, dropFrom = null;
const keys = { left: false, right: false };
let jumpQueued = false;
let raf = 0, last = 0, idleFor = 0, animT = 0, frame = 0;
let row = null;
let arc = null;
let runStart = 0;
let ro = null, remeasureT = 0;

// ---------------------------------------------------------------- measuring (events only)
const vis = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { x1: r.left + scrollX, x2: r.right + scrollX, y: r.top + scrollY, b: r.bottom + scrollY };
}
function measure() {
  const list = [];
  const add = (el, kind, pad = 0) => {
    if (!vis(el)) return;
    const r = rectOf(el);
    if (r.x2 - r.x1 < 24) return;
    list.push({ el, kind, x1: r.x1 + pad, x2: r.x2 - pad, y: r.y, key: el.dataset?.focus || null });
  };
  const name = $('.hero__name-t') || $('.hero__name');
  if (name) {
    const r = rectOf(name);
    const fs = parseFloat(getComputedStyle(name).fontSize) || 80;
    // stand on the cap height, not on the line box
    list.push({ el: name, kind: 'name', x1: r.x1 + 4, x2: r.x2 - 4, y: r.y + fs * 0.2, key: null });
  }
  $$('main .card').forEach((el) => add(el, 'card', 6));
  $$('main [data-focus]').forEach((el) => add(el, 'row', 2));
  $$('main > .trail').forEach((el) => add(el, 'trail'));
  add($('#credits'), 'foot');
  add($('.foot'), 'foot');
  plats = list.sort((a, b) => a.y - b.y);
  tokens = $$('main .token').filter((t) => !t.hidden && vis(t)).map((el) => ({ el, ...rectOf(el) }));
  if (ground) {
    const same = plats.find((p) => p.el === ground.el);
    if (same) { ground = same; y = same.y; } else ground = null;
  }
  draw();
}
function remeasureSoon() {
  clearTimeout(remeasureT);
  remeasureT = setTimeout(() => { if (active) { measure(); wakeLoop(); } }, 120);
}

// ---------------------------------------------------------------- drawing
function draw() {
  if (!walker) return;
  walker.style.transform = `translate(${Math.round(x - W / 2)}px, ${Math.round(y - H)}px)`;
  face.style.transform = facing < 0 ? 'scaleX(-1)' : '';
  const want = ground ? (vx && !rm() ? frame : 0) : 1;
  const src = frames[want]?.url || frames[0]?.url;
  if (img.getAttribute('src') !== src) img.src = src;
  walker.classList.toggle('is-air', !ground);
}

// ---------------------------------------------------------------- rows
function setRow(el) {
  if (row === el) return;
  if (row) { row.classList.remove('is-walk'); }
  row = el;
  const w = world();
  if (row) {
    row.classList.add('is-walk');
    try { w?.stage?.setHover?.(row.dataset.focus); } catch { /* world asleep */ }
    emit('bit:goto', row);
  } else {
    try { w?.stage?.setHover?.(null); } catch { /* world asleep */ }
  }
}
function landed(p) {
  ground = p;
  airJumps = 1;
  vy = 0;
  y = p.y;
  setRow(p.kind === 'row' ? p.el : null);
  if (p.kind === 'foot' && runStart) {
    const t = (performance.now() - runStart) / 1000;
    runStart = 0;
    if (t < 60) {
      float(walker, `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, { tone: 'gold' });
      found('speedrun');
    }
  }
}

// ---------------------------------------------------------------- the loop (only while moving)
function wakeLoop() {
  if (!active || raf) return;
  last = performance.now();
  idleFor = 0;
  raf = requestAnimationFrame(step);
}
function step(now) {
  raf = 0;
  if (!active) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (arc) stepArc(now);
  else physics(dt);
  // walk cycle
  if (ground && vx) { animT += dt; if (animT > 0.14) { animT = 0; frame = frame ? 0 : 1; } }
  collect();
  follow(dt);
  draw();
  const moving = arc || !ground || vx || jumpQueued;
  idleFor = moving ? 0 : idleFor + dt;
  if (idleFor < 0.3) raf = requestAnimationFrame(step);
}

function physics(dt) {
  vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (vx) facing = vx;
  const docW = html.clientWidth;
  x = Math.max(W / 2, Math.min(docW - W / 2, x + vx * SPEED * dt));
  if (jumpQueued) {
    jumpQueued = false;
    if (ground || airJumps > 0) {
      if (!ground) airJumps--;
      if (rm()) { hopUp(); return; }
      ground = null; vy = -V0; sfx('pop');
    }
  }
  if (ground) {
    // walked off the edge?
    if (x < ground.x1 - 8 || x > ground.x2 + 8) { ground = null; vy = 0; setRow(null); }
    else { y = ground.y; return; }
  }
  const y0 = y;
  vy = Math.min(1500, vy + G * dt);
  let ny = y + vy * dt;
  if (vy >= 0) {
    // stomp a critter on the way down
    for (const c of critters()) {
      const r = c.getBoundingClientRect();
      const top = r.top + scrollY + 8, cx1 = r.left + scrollX + 4, cx2 = r.right + scrollX - 4;
      if (x > cx1 - 12 && x < cx2 + 12 && y0 <= top + 6 && ny >= top) {
        c.click();
        sfx('hit');
        vy = -V0 * 0.7; ny = top; airJumps = 1;
        break;
      }
    }
  }
  if (vy >= 0) {
    for (const p of plats) {
      if (p === dropFrom) continue;
      if (x < p.x1 - 6 || x > p.x2 + 6) continue;
      if (y0 <= p.y + 0.5 && ny >= p.y) { y = p.y; landed(p); dropFrom = null; if (!rm()) dust(); return; }
    }
  }
  y = ny;
  if (dropFrom && y > dropFrom.y + 6) dropFrom = null;
  // fell off the world: back to the nearest ledge above the viewport's middle
  if (y > html.scrollHeight + 200) respawn();
}
function dust() {
  if (!walker) return;
  walker.classList.remove('is-land');
  void walker.offsetWidth;
  walker.classList.add('is-land');
}

/** Reduced motion: jumps and drops are instant hops to the next ledge. */
function hopUp() {
  const cands = plats.filter((p) => p.y < y - 4 && p.y > y - JUMP_H * 1.4 && x >= p.x1 - 6 && x <= p.x2 + 6);
  const p = cands[cands.length - 1];
  if (p) { landed(p); sfx('pop'); } else float(walker, '↑', { tone: 'ink' });
}
function hopDown() {
  const p = plats.find((q) => q.y > y + 4 && x >= q.x1 - 6 && x <= q.x2 + 6);
  if (p) landed(p);
}

function collect() {
  if (!tokens.length) return;
  const bx1 = x - W / 2, bx2 = x + W / 2, by1 = y - H, by2 = y;
  for (const t of tokens) {
    if (t.got || t.el.hidden || t.el.classList.contains('is-got')) continue;
    if (bx2 > t.x1 + 10 && bx1 < t.x2 - 10 && by2 > t.y + 10 && by1 < t.b - 10) { t.got = true; t.el.click(); }
  }
}

/** Keep the scholar between 30% and 70% of the viewport. */
function follow(dt) {
  const sy = y - H / 2 - scrollY;
  const lo = innerHeight * 0.3, hi = innerHeight * 0.7;
  let target = null;
  if (sy < lo) target = y - H / 2 - lo;
  else if (sy > hi) target = y - H / 2 - hi;
  if (target == null) return;
  const k = rm() ? 1 : Math.min(1, dt * 10);
  window.scrollTo({ top: Math.max(0, scrollY + (target - scrollY) * k), behavior: 'instant' });
}

// ---------------------------------------------------------------- tap to hop (touch, or a click on a row)
function arcTo(p) {
  if (!p) return;
  if (rm()) { x = Math.max(p.x1 + 20, Math.min(p.x2 - 20, x)); landed(p); draw(); return; }
  const tx = Math.max(p.x1 + 24, Math.min(p.x2 - 24, x < p.x1 || x > p.x2 ? (p.x1 + p.x2) / 2 : x));
  arc = { x0: x, y0: y, x1: tx, p, t0: performance.now(), ms: 560, peak: Math.min(y, p.y) - 90 };
  facing = tx >= x ? 1 : -1;
  ground = null;
  setRow(null);
  sfx('pop');
  wakeLoop();
}
function stepArc(now) {
  const a = arc;
  const t = Math.min(1, (now - a.t0) / a.ms);
  x = a.x0 + (a.x1 - a.x0) * t;
  // quadratic bezier through the peak
  const cy = 2 * a.peak - (a.y0 + a.p.y) / 2;
  y = (1 - t) * (1 - t) * a.y0 + 2 * (1 - t) * t * cy + t * t * a.p.y;
  if (t >= 1) { arc = null; x = a.x1; landed(a.p); dust(); }
}

// ---------------------------------------------------------------- spawn
function spawnPoint() {
  const heroName = plats.find((p) => p.kind === 'name');
  if (heroName && scrollY < innerHeight * 0.5) return { p: heroName, x: heroName.x1 + 30, run: true };
  const top = scrollY + (document.getElementById('bar')?.getBoundingClientRect().bottom || 60) + 70;
  const bottom = scrollY + innerHeight * 0.6;
  const p = plats.find((q) => q.y >= top && q.y <= bottom && q.kind !== 'foot') || plats.find((q) => q.y >= top) || plats[0];
  return p ? { p, x: Math.min(p.x2 - 30, p.x1 + 40) } : null;
}
function respawn() {
  const s = spawnPoint();
  if (!s) return;
  x = s.x; y = s.p.y; landed(s.p);
}

// ---------------------------------------------------------------- input
function onKeyDown(e) {
  if (!active || e.metaKey || e.ctrlKey || e.altKey) return;
  if (isEditable(e.target)) { stop(); return; }
  let used = true;
  switch (e.key) {
    case 'ArrowLeft': keys.left = true; break;
    case 'ArrowRight': keys.right = true; break;
    case ' ': case 'Spacebar': case 'ArrowUp': if (!e.repeat) jumpQueued = true; break;
    case 'ArrowDown':
      if (ground && !e.repeat) {
        if (rm()) hopDown();
        else { dropFrom = ground; ground = null; vy = 60; setRow(null); }
      }
      break;
    case 'Escape': stop(); break;
    case 'p': case 'P': if (!e.repeat) stop(); break;
    default: used = false;
  }
  if (used) { e.preventDefault(); e.stopImmediatePropagation(); wakeLoop(); }
}
function onKeyUp(e) {
  if (!active) return;
  if (e.key === 'ArrowLeft') keys.left = false;
  else if (e.key === 'ArrowRight') keys.right = false;
  else return;
  wakeLoop();
}
function onClick(e) {
  if (!active || !(e.target instanceof Element)) return;
  if (e.target.closest('a, button, summary, input, textarea, select, label, [role="button"], pre, code')) return;
  const el = e.target.closest('main [data-focus]');
  if (!el) return;
  measure();
  arcTo(plats.find((p) => p.el === el));
}
function onFocusIn(e) { if (active && isEditable(e.target)) stop(); }
function onBlur() { keys.left = keys.right = false; }

// ---------------------------------------------------------------- start / stop
function buildWalker() {
  frames = frameUrls('scholar');
  img = h('img', { class: 'px walker__img', alt: '', width: W, height: H, draggable: 'false' });
  img.src = frames[0]?.url || '';
  face = h('span', { class: 'walker__face' }, img);
  walker = h('div', { class: 'walker', 'aria-hidden': 'true' }, face, h('span', { class: 'walker__shadow' }));
  layer = h('div', { class: 'walk-layer', 'data-game': '', 'aria-hidden': 'true' }, walker);
}
function buildChip() {
  const tools = $('.bar__tools');
  if (!tools) return;
  chip = h('button', { type: 'button', class: 'walk-chip', title: 'Stop walking (Esc or P)', onclick: () => stop() },
    h('span', { class: 'walk-chip__k' }, 'Walking'),
    h('span', { class: 'walk-chip__h' }, '← → · Space · ↓ · Esc'),
    h('span', { class: 'walk-chip__x', 'aria-hidden': 'true' }, '×'));
  chip.setAttribute('aria-label', 'Stop walking');
  tools.prepend(chip);
}

export function start() {
  if (active || !isGame() || isPlain()) return;
  const w = world();
  if (w?.playing) { try { w.exitPlay(); } catch { /* not playing */ } }
  active = true;
  html.classList.add('is-walking');
  if (!walker) buildWalker();
  document.body.append(layer);
  measure();
  const s = spawnPoint();
  if (!s) { stop(); return; }
  facing = 1; vx = 0; ground = null; airJumps = 1; dropFrom = null;
  x = s.x;
  runStart = s.run ? performance.now() : 0;
  if (rm()) { landed(s.p); }
  else { y = s.p.y - 90; vy = 0; burst(document.querySelector('.hero__name') && s.run ? $('.hero__name') : s.p.el, { n: 5, kind: 'spark' }); }
  draw();
  buildChip();
  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp, true);
  addEventListener('blur', onBlur);
  document.addEventListener('click', onClick, true);
  document.addEventListener('focusin', onFocusIn);
  addEventListener('resize', remeasureSoon);
  document.addEventListener('toggle', remeasureSoon, true);
  ro = ro || new ResizeObserver(remeasureSoon);
  const main = $('main');
  if (main) ro.observe(main);
  live('Walk mode on. Arrow keys to walk, Space to jump, Down to drop, Esc to stop.');
  sfx('open');
  emit('walk:mode', true);
  if (matchMedia('(pointer: coarse)').matches) speak('me', 'Tap a row and I will hop there.');
  else speak('me', 'Stretching my legs. Arrows to walk, Space to jump.');
  wakeLoop();
}

export function stop() {
  if (!active) return;
  active = false;
  cancelAnimationFrame(raf); raf = 0;
  arc = null; keys.left = keys.right = false; jumpQueued = false;
  setRow(null);
  html.classList.remove('is-walking');
  layer?.remove();
  chip?.remove(); chip = null;
  removeEventListener('keydown', onKeyDown, true);
  removeEventListener('keyup', onKeyUp, true);
  removeEventListener('blur', onBlur);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('focusin', onFocusIn);
  removeEventListener('resize', remeasureSoon);
  document.removeEventListener('toggle', remeasureSoon, true);
  ro?.disconnect();
  live('Walk mode off.');
  emit('walk:mode', false);
}
export const toggle = () => (active ? stop() : start());
export const walking = () => active;

export function init(ctx) {
  registerEgg({ id: 'speedrun', name: 'Speedrun', hint: 'Walk the page, top to bottom, fast.', done: 'Any% glitchless.' });
  registerKey('p', () => { toggle(); });
  on('walk:toggle', toggle);
  // the 3D play mode takes over the keyboard and hides the page; Reviewer mode hides the game
  on('mode', (m) => { if (m === 'play') stop(); });
  ctx?.mode?.onMode?.((st) => { if (st.plain) stop(); });
  html.classList.add('has-walk');
  emit('walk:ready');
}
