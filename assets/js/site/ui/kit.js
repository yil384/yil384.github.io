// The shared component kit for the interactive CV (SPEC §5.1). Section, companion and world-link code
// build on these helpers instead of rolling their own: one IntersectionObserver per option set, one
// particle layer (≤40 live DOM particles, transform/opacity only), one aria-live region, one bubble per
// anchor. Everything is safe without the 3D world, and honours html.rm (reduced motion).
/* global CustomEvent */
import { h } from '../../game3d/util.js';
import { spriteImg } from '../../game3d/pixelart.js';
import { on, emit } from '../../game3d/bus.js';
import { sfx as rawSfx } from '../../game3d/audio.js';
import { pushToast } from '../eggs.js';
import { P, save } from './pstate.js';

export { h, isEditable } from '../../game3d/util.js';
export { spriteImg, spriteUrl } from '../../game3d/pixelart.js';
export { on, emit } from '../../game3d/bus.js';
export { found, has } from '../eggs.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const world = () => window.__page?.world || null;
const html = document.documentElement;
export const rm = () => html.classList.contains('rm');
export const isGame = () => html.classList.contains('is-game');
export const isPlain = () => html.classList.contains('is-plain');

/** npc id → sprite name in three/art.js (for bubbles, avatars and the Bit fallback). */
export const NPC_SPRITE = { me: 'scholar', bit: 'bit', nell: 'owl', unit7: 'robot', mo: 'merchant', tide: 'frog', fern: 'sprout', ash: 'cartographer', zhuo: 'chef' };
export const NPC_NAME = { me: 'Yichen', bit: 'Bit', nell: 'Nell', unit7: 'Unit-7', mo: 'Mo', tide: 'Tide', fern: 'Fern', ash: 'Ash', zhuo: 'Chef Zhuo' };

// ---------------------------------------------------------------- sound (throttled)
const sfxLog = new Map();
/** audio.sfx with a budget: ≤6 per second per name; blips (buddy, tick) at most one per 80ms. */
export function sfx(name) {
  const now = performance.now();
  const log = sfxLog.get(name) || [];
  if (name === 'buddy' || name === 'tick') {
    if (log.length && now - log[log.length - 1] < 80) return;
    sfxLog.set(name, [now]);
  } else {
    const recent = log.filter((t) => now - t < 1000);
    if (recent.length >= 6) return;
    recent.push(now);
    sfxLog.set(name, recent);
  }
  rawSfx(name);
}

// ---------------------------------------------------------------- fx layer (particles, floats, bubbles)
let fxLayer = null;
function layer() {
  if (fxLayer?.isConnected) return fxLayer;
  fxLayer = h('div', { class: 'fx-layer' });
  document.body.append(fxLayer);
  return fxLayer;
}
const vw = () => document.documentElement.clientWidth;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Page coordinates of a point on an element: ax/ay in [0,1] across its box. */
function pagePoint(el, ax = 0.5, ay = 0.5) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * ax + scrollX, y: r.top + r.height * ay + scrollY, r };
}
/* global scrollX */

let alive = 0;
const MAX_PARTICLES = 40;
function particle(cls, x, y, vars, life = 900) {
  if (alive >= MAX_PARTICLES) return null;
  const el = h('i', { class: `fx-p ${cls}`, 'aria-hidden': 'true' });
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  for (const [k, v] of Object.entries(vars || {})) el.style.setProperty(k, v);
  alive++;
  let done = false;
  const kill = () => { if (done) return; done = true; alive--; el.remove(); };
  el.addEventListener('animationend', kill, { once: true });
  setTimeout(kill, life + 400);
  layer().append(el);
  return el;
}

/** A small rising label ('+5 XP', '+1 ◈') from an element. tone: gold | xp | cash | red | teal | ink */
export function float(fromEl, text, { tone = 'gold' } = {}) {
  if (!fromEl?.isConnected) return null;
  const { x, y } = pagePoint(fromEl, 0.5, 0);
  const el = particle(`float float--${tone}`, x, y, { '--dx': `${(Math.random() - 0.5) * 16}px` }, 800);
  if (el) el.textContent = text;
  return el;
}

const PALETTE = { spark: ['#FFCD00', '#fff3b0', '#f2b84b'], coin: ['#FFCD00'], drop: ['#7dd3fc', '#38bdf8'], heart: ['#f472b6', '#fb7185'], confetti: ['#FFCD00', '#00C6D7', '#4ADE80', '#B58CFF', '#F87171', '#5FB3FF'] };
/** DOM particles from an element (capped at 40 alive). kind: spark | coin | drop | heart | confetti */
export function burst(fromEl, { n = 8, colors, kind = 'spark' } = {}) {
  if (!fromEl?.isConnected || rm()) return;
  const { x, y } = pagePoint(fromEl, 0.5, 0.4);
  const cols = colors || PALETTE[kind] || PALETTE.spark;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const up = kind === 'drop' || kind === 'heart';
    const d = kind === 'confetti' ? 60 + Math.random() * 70 : 22 + Math.random() * 30;
    const dx = Math.cos(a) * d * (up ? 0.5 : 1);
    const dy = up ? -(30 + Math.random() * 40) : Math.sin(a) * d - (kind === 'coin' ? 30 : 10);
    particle(`${kind}-fx`, x, y, { '--dx': `${dx.toFixed(1)}px`, '--dy': `${dy.toFixed(1)}px`, '--c': cols[i % cols.length], '--r': `${Math.round(Math.random() * 360)}deg`, '--dur': `${600 + Math.round(Math.random() * 300)}ms` }, 900);
  }
}

/** A ghost that arcs from one element to another (e.g. a coin into the HUD cash). Resolves when it lands. */
export function flyTo(fromEl, toEl, { sprite, html: inner, ms = 520 } = {}) {
  const land = () => { if (toEl) { toEl.classList.remove('is-hit'); void toEl.offsetWidth; toEl.classList.add('is-hit'); setTimeout(() => toEl.classList.remove('is-hit'), 420); } };
  if (!fromEl?.isConnected || !toEl?.isConnected || rm() || alive >= MAX_PARTICLES || !toEl.getClientRects().length) { land(); return Promise.resolve(); }
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const ghost = h('div', { class: 'fly-ghost', 'aria-hidden': 'true' });
  if (sprite) ghost.append(spriteImg(sprite, 2));
  else if (inner) ghost.innerHTML = inner;
  else ghost.classList.add('fly-ghost--coin');
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
  ghost.style.left = `${x0}px`; ghost.style.top = `${y0}px`;
  document.body.append(ghost);
  alive++;
  const lift = Math.min(120, 40 + Math.abs(dx) * 0.15);
  const anim = ghost.animate([
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - lift}px)) scale(1.15)`, opacity: 1, offset: 0.45 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.55)`, opacity: 0.35 },
  ], { duration: ms, easing: 'cubic-bezier(.3,.1,.3,1)' });
  return new Promise((res) => {
    const end = () => { if (!ghost.isConnected) return; ghost.remove(); alive--; land(); res(); };
    anim.onfinish = end; anim.oncancel = end;
    setTimeout(end, ms + 300);
  });
}

// ---------------------------------------------------------------- speech
const bubbles = new WeakMap();
/**
 * A speech bubble next to an element (page coordinates, so it scrolls with the card).
 * place: auto | above | below | right. Returns { el, close }.
 */
export function bubble(anchor, text, { who, ms = 3200, place = 'auto' } = {}) {
  if (!anchor?.isConnected) return { el: null, close() {} };
  bubbles.get(anchor)?.close();
  const el = h('div', { class: 'bubble', role: 'status' });
  if (who && NPC_SPRITE[who]) {
    const av = h('span', { class: 'bubble__who', title: NPC_NAME[who] || who });
    av.append(spriteImg(NPC_SPRITE[who], 2));
    el.append(av);
  }
  el.append(h('span', { class: 'bubble__t' }, text));
  const L = layer();
  el.style.visibility = 'hidden';
  L.append(el);
  const r = anchor.getBoundingClientRect();
  const bw = el.offsetWidth, bh = el.offsetHeight, W = vw();
  const barH = document.getElementById('bar')?.getBoundingClientRect().bottom || 60;
  const roomAbove = r.top - bh - 14 > barH + 8;
  let side = place;
  if (side === 'right' && r.right + 18 + bw > W - 8) side = 'auto';
  if (side === 'auto') side = roomAbove ? 'above' : 'below';
  else if (side === 'above' && !roomAbove) side = 'below';
  let x, y;
  if (side === 'right') { x = r.right + 14; y = r.top + Math.min(r.height / 2, 24) - bh / 2; el.classList.add('bubble--right'); }
  else {
    const ax = r.width > 320 ? r.right - 90 : r.left + r.width / 2;
    x = clamp(ax - bw / 2, 8, W - bw - 8);
    el.style.setProperty('--tx', `${clamp(ax - x, 14, bw - 14)}px`);
    y = side === 'above' ? r.top - bh - 12 : r.bottom + 12;
    el.classList.add(side === 'above' ? 'bubble--above' : 'bubble--below');
  }
  el.style.left = `${Math.round(x + scrollX)}px`;
  el.style.top = `${Math.round(y + scrollY)}px`;
  el.style.visibility = '';
  requestAnimationFrame(() => el.classList.add('is-in'));
  let t = 0;
  const close = () => {
    clearTimeout(t);
    if (bubbles.get(anchor)?.el === el) bubbles.delete(anchor);
    el.classList.remove('is-in'); el.classList.add('is-out');
    setTimeout(() => el.remove(), 220);
  };
  if (ms > 0) t = setTimeout(close, ms);
  const handle = { el, close };
  bubbles.set(anchor, handle);
  return handle;
}

/**
 * An islander speaks: in the 3D world when it is live, otherwise through Bit on the page
 * (emits 'ui:say' {who, text, handled}; Bit sets handled). Last resort: a bubble on the current card.
 */
export function say(who, text) {
  const w = world();
  if (w && document.body.classList.contains('world-live') && !isPlain() && !html.classList.contains('is-play')) {
    try { w.say(who, text); return; } catch { /* fall through to the page */ }
  }
  const payload = { who, text, handled: false };
  emit('ui:say', payload);
  if (payload.handled || !isGame()) return;
  const cur = currentSection();
  const anchor = cur?.card?.querySelector('.card-head') || cur?.card || cur?.el?.querySelector('.hero__name');
  if (anchor) bubble(anchor, text, { who, place: 'above' });
}

/** A rubber stamp thumped into a slot. tone: ok | gold | red | ink | violet; size: sm | md | lg. */
export function stamp(slotEl, text, { tone = 'ok', rot = -8, size = 'md', silent = false } = {}) {
  if (!slotEl) return null;
  const el = h('span', { class: `stamp stamp--${tone} stamp--${size}`, style: { '--rot': `${rot}deg` } }, text);
  slotEl.replaceChildren(el);
  if (!silent) {
    el.classList.add('is-thump');
    sfx('stamp');
    const card = slotEl.closest('.card, [data-focus]');
    if (card && !rm()) { card.classList.remove('is-nudge'); void card.offsetWidth; card.classList.add('is-nudge'); setTimeout(() => card.classList.remove('is-nudge'), 260); }
  }
  return el;
}

/** Types text into el as one text node (40 cps by default). Instant under reduced motion. */
const writers = new WeakMap();
export function typewriter(el, text, { cps = 40, sound = true, append = false } = {}) {
  if (!el) return Promise.resolve();
  const token = {};
  writers.set(el, token);
  if (!append) el.textContent = '';
  const node = document.createTextNode('');
  el.append(node);
  if (rm() || !cps || cps <= 0) { node.data = text; return Promise.resolve(); }
  return new Promise((res) => {
    let shown = 0, t0 = 0;
    const step = (now) => {
      if (writers.get(el) !== token) { node.data = text; return res(); }
      if (!t0) t0 = now;
      const n = Math.min(text.length, Math.floor(((now - t0) / 1000) * cps) + 1);
      if (n > shown) {
        if (sound && Math.floor(n / 3) > Math.floor(shown / 3)) sfx('tick');
        shown = n;
        node.data = text.slice(0, n);
      }
      if (n >= text.length) { if (writers.get(el) === token) writers.delete(el); return res(); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---------------------------------------------------------------- toasts and announcements
/** A toast in the shared stack (max 3). kind: info | ach. */
export function toast(title, sub, { kind = 'info', k } = {}) {
  const el = h('div', { class: `egg-toast--${kind}` });
  const medal = h('span', { class: 'toast__medal', 'aria-hidden': 'true' });
  medal.append(h('img', { src: `assets/icons/ui/${kind === 'ach' ? 'trophy' : 'sparkle'}.svg`, alt: '', width: 18, height: 18 }));
  const body = h('div', null,
    h('div', { class: 'egg-toast__k' }, k || (kind === 'ach' ? 'Achievement' : 'Notice')),
    h('div', { class: 'egg-toast__t' }, title),
    sub ? h('div', { class: 'egg-toast__s' }, sub) : null);
  el.append(medal, body);
  return pushToast(el, kind === 'ach' ? 5200 : 4200);
}

let liveEl = null, liveQ = [], liveT = 0;
/** One polite aria-live region for the whole page game (throttled so messages never pile up). */
export function live(msg) {
  if (!msg) return;
  if (!liveEl?.isConnected) { liveEl = h('div', { class: 'sr', id: 'kit-live', 'aria-live': 'polite', role: 'status' }); document.body.append(liveEl); }
  liveQ.push(String(msg));
  if (liveQ.length > 3) liveQ = liveQ.slice(-3);
  if (liveT) return;
  const flush = () => {
    const m = liveQ.shift();
    if (m == null) { liveT = 0; return; }
    liveEl.textContent = '';
    setTimeout(() => { liveEl.textContent = m; }, 40);
    liveT = setTimeout(flush, 900);
  };
  flush();
}

/** Clipboard with fallbacks; on failure selects selectEl's text so the reader can press Ctrl/Cmd+C. */
export async function copyText(text, { selectEl } = {}) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* permission denied: try the old way */ }
  try {
    const ta = h('textarea', { readonly: '', 'aria-hidden': 'true', style: { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return true;
  } catch { /* no execCommand */ }
  if (selectEl) {
    const r = document.createRange();
    r.selectNodeContents(selectEl);
    const s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
  }
  return false;
}

// ---------------------------------------------------------------- input helpers
/** n clicks within windowMs → fn(). Returns a function that resets the counter. */
export function clicks(el, n, windowMs, fn) {
  let times = [];
  el?.addEventListener('click', (e) => {
    const t = performance.now();
    times = times.filter((x) => t - x < windowMs);
    times.push(t);
    if (times.length >= n) { times = []; fn(e); }
  });
  return () => { times = []; };
}

/** Long press (pointer held, or Enter/Space held) for ms → fn(). Returns a disposer. */
export function hold(el, ms, fn) {
  if (!el) return () => {};
  let t = 0;
  const start = (e) => { clearTimeout(t); t = setTimeout(() => fn(e), ms); };
  const stop = () => clearTimeout(t);
  const kd = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) start(e); };
  const ku = (e) => { if (e.key === 'Enter' || e.key === ' ') stop(); };
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, stop));
  el.addEventListener('keydown', kd);
  el.addEventListener('keyup', ku);
  return () => {
    stop();
    el.removeEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.removeEventListener(ev, stop));
    el.removeEventListener('keydown', kd);
    el.removeEventListener('keyup', ku);
  };
}

/** Makes a non-button element (e.g. a span in a title) keyboard-operable. */
export function upgradeButton(el, label) {
  if (!el || el.dataset.btn) return el;
  el.dataset.btn = '1';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  if (label) el.setAttribute('aria-label', label);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); el.click(); }
  });
  return el;
}

/** Handle the E key ('ui:primary' CustomEvent) on an item. Returns a remover. */
export function primary(el, fn) {
  if (!el) return () => {};
  const h_ = (e) => { e.preventDefault?.(); fn(e); };
  el.addEventListener('ui:primary', h_);
  return () => el.removeEventListener('ui:primary', h_);
}
/** Dispatch helper used by keys.js; returns true when a handler took it. */
export function dispatchPrimary(el, type = 'ui:primary') {
  const ev = new CustomEvent(type, { bubbles: true, cancelable: true });
  return !el.dispatchEvent(ev);
}

/**
 * Grid-rows expander for a [hidden] panel: 0fr → 1fr, no layout jump. Sets aria-expanded on its
 * controller ([aria-controls=id]). open undefined → toggle. Resolves with the new state.
 */
export function expand(el, open) {
  if (!el) return Promise.resolve(false);
  const isOpen = !el.hidden && el.classList.contains('is-open');
  const want = open == null ? !isOpen : !!open;
  if (!el.querySelector(':scope > .x-in')) {
    const inner = h('div', { class: 'x-in' });
    inner.append(...el.childNodes);
    el.append(inner);
  }
  el.classList.add('x-exp');
  if (el.id) document.querySelectorAll(`[aria-controls="${el.id}"]`).forEach((c) => c.setAttribute('aria-expanded', String(want)));
  return new Promise((res) => {
    if (want) {
      el.hidden = false;
      void el.offsetHeight;
      el.classList.add('is-open');
      res(true);
    } else {
      el.classList.remove('is-open');
      const done = () => { if (!el.classList.contains('is-open')) el.hidden = true; res(false); };
      if (rm()) done(); else setTimeout(done, 260);
    }
  });
}

// ---------------------------------------------------------------- observation
const ios = new Map();
function enough(e, t) {
  if (!e.isIntersecting) return false;
  if (t <= 0) return true;
  if (e.intersectionRatio >= t - 0.001) return true;
  // elements taller than the viewport can never reach the ratio: count the share of the viewport instead
  const rb = e.rootBounds;
  return !!rb && e.intersectionRect.height >= rb.height * Math.min(t, 0.6);
}
/**
 * Shared IntersectionObservers (one per threshold/rootMargin pair). once: fn(entry) the first time the
 * element is visible enough, then stops. Not once: fn(entry, visibleEnough) on every change.
 * Returns an unobserve function.
 */
export function observe(el, { threshold = 0.5, once = true, rootMargin = '0px' } = {}, fn) {
  if (!el || typeof fn !== 'function') return () => {};
  if (!('IntersectionObserver' in window)) { fn({ target: el, isIntersecting: true, intersectionRatio: 1 }, true); return () => {}; }
  const key = `${threshold}|${rootMargin}`;
  let o = ios.get(key);
  if (!o) {
    const map = new Map();
    const ts = [...new Set([0, 0.1, 0.25, threshold, 0.75, 1].filter((x) => x >= 0 && x <= 1))].sort((a, b) => a - b);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const recs = map.get(e.target);
        if (!recs) continue;
        const ok = enough(e, threshold);
        for (const r of [...recs]) {
          if (r.once) { if (ok) { r.off(); r.fn(e, true); } }
          else r.fn(e, ok);
        }
      }
    }, { threshold: ts, rootMargin });
    o = { io, map };
    ios.set(key, o);
  }
  const rec = { fn, once };
  rec.off = () => {
    const set = o.map.get(el);
    if (!set) return;
    set.delete(rec);
    if (!set.size) { o.map.delete(el); o.io.unobserve(el); }
  };
  if (!o.map.has(el)) { o.map.set(el, new Set()); o.io.observe(el); }
  o.map.get(el).add(rec);
  return rec.off;
}

const dwells = new Set();
let dwellTimer = 0;
function dwellTick() {
  if (document.hidden) return;
  const now = performance.now();
  for (const d of dwells) {
    if (d.visible) {
      d.acc += now - d.last;
      if (d.acc >= d.ms) { d.stop(); try { d.fn(d.el); } catch (err) { console.error('[kit] dwell', err); } }
    }
    d.last = now;
  }
  if (!dwells.size) { clearInterval(dwellTimer); dwellTimer = 0; }
}
/** fn(el) once the element has been ≥50% visible (or filled half the viewport) for ms, cumulative. */
export function dwell(el, ms, fn) {
  if (!el) return () => {};
  const d = { el, ms, fn, acc: 0, visible: false, last: performance.now() };
  const off = observe(el, { threshold: 0.5, once: false }, (_e, ok) => { d.visible = ok; d.last = performance.now(); });
  d.stop = () => { off(); dwells.delete(d); };
  dwells.add(d);
  if (!dwellTimer) dwellTimer = setInterval(dwellTick, 250);
  return d.stop;
}

// ---------------------------------------------------------------- sections
let cur = null;
const sectionFns = new Set();
const sectionOf = (sec) => sec ? { id: sec.id, shot: sec.dataset.shot || '', el: sec, card: sec.querySelector(':scope > .card') } : null;
function setCurrent(sec) {
  if (!sec || cur?.el === sec) return;
  cur?.el.classList.remove('is-current-sec');
  cur = sectionOf(sec);
  sec.classList.add('is-current-sec');
  for (const f of [...sectionFns]) { try { f(cur); } catch (err) { console.error('[kit] onSection', err); } }
  emit('ui:section', cur);
}
function startSections() {
  const secs = $$('main section[data-shot]');
  // the section crossing a thin band just above the middle of the viewport is current (world or not)
  for (const sec of secs) observe(sec, { threshold: 0, once: false, rootMargin: '-44% 0px -54% 0px' }, (e) => { if (e.isIntersecting) setCurrent(sec); });
  // the director's own section changes win when the world is running
  on('shot', ({ el } = {}) => { const s = el?.closest?.('main section[data-shot]'); if (s) setCurrent(s); });
  // pause CSS loops of sections (and trail strips) that are off screen
  for (const el of $$('main > section, main > .trail')) observe(el, { threshold: 0, once: false, rootMargin: '120px 0px' }, (e) => el.classList.toggle('is-live', e.isIntersecting));
  if (!cur) {
    const mid = innerHeight * 0.45;
    setCurrent(secs.find((s) => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; }) || secs[0]);
  }
}
/** fn({ id, shot, el, card }) whenever the current section changes. Called once right away if known. */
export function onSection(fn) {
  sectionFns.add(fn);
  if (cur) queueMicrotask(() => { if (sectionFns.has(fn)) fn(cur); });
  return () => sectionFns.delete(fn);
}
export const currentSection = () => cur;

/** Without the world a click still lands somewhere: the poster behind the page flashes. */
export function echo() {
  if (world() && document.body.classList.contains('world-live')) return;
  const p = $('.world__poster');
  if (!p) return;
  p.classList.remove('is-echo'); void p.offsetWidth; p.classList.add('is-echo');
  setTimeout(() => p.classList.remove('is-echo'), 420);
}

/** True the first time per save (stored in P.once). */
export function once(key) {
  const k = `o:${key}`;
  if (P.once[k]) return false;
  P.once[k] = Date.now();
  save();
  return true;
}
const sess = new Set();
/** True the first time per page load. */
export function sessionOnce(key) {
  if (sess.has(key)) return false;
  sess.add(key);
  return true;
}

startSections();
