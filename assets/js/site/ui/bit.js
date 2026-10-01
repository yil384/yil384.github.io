// Bit, the page companion (SPEC §2.6). A small blue buddy perched on the top edge of the current card
// (right of centre, left of the seal slot; top-left on phones). It hops between cards when the chapter
// changes (FLIP arc), slides along the edge to the row you point at, hands out three hints per chapter,
// likes being petted, bowls into the chapter's critter on a double-click, dozes when left alone, and is
// the page's voice when there is no 3D world: kit.say() → 'ui:say' → Bit shows the line with the
// speaker's avatar, next to its perch, in the world-side gutter, or (narrow screens) as a toast.
// Never over CV text: the perch is the card border, bubbles live above the card or in the gutter.
/* global getComputedStyle */
import { ART, VARIANTS } from '../../three/art.js';
import { pushToast } from '../eggs.js';
import {
  h, on, emit, found, has, world, rm, isGame, sfx, burst, float, live, onSection, currentSection,
  sessionOnce, NPC_SPRITE, NPC_NAME,
} from './kit.js';

// ---------------------------------------------------------------- sprite frames (shared with critters / walk)
const frameCache = new Map();
/** Data URLs (1px per cell) of a sprite's frames from three/art.js; edit(grid, i) may return a changed grid. */
export function frameUrls(name, edit = null, key = '') {
  const ck = `${name}|${key}`;
  if (frameCache.has(ck)) return frameCache.get(ck);
  const base = VARIANTS[name] ? VARIANTS[name][0] : name;
  const art = ART[base];
  if (!art) return [];
  const pal = { ...art.pal, ...(VARIANTS[name] ? VARIANTS[name][1] : null) };
  const out = art.frames.map((g0, i) => {
    const grid = edit ? edit(g0.slice(), i) || g0 : g0;
    const w = Math.max(...grid.map((r) => r.length)), hh = grid.length;
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const g = c.getContext('2d');
    grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = pal[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
    return { url: c.toDataURL(), w, h: hh };
  });
  frameCache.set(ck, out);
  return out;
}
/** A crisp <img> of frame i at an integer scale. */
export function frameImg(name, scale = 2, i = 0, cls = '', edit = null, key = '') {
  const f = frameUrls(name, edit, key)[i] || frameUrls(name, edit, key)[0];
  const img = document.createElement('img');
  img.className = `px ${cls}`.trim();
  img.alt = '';
  img.draggable = false;
  if (f) { img.src = f.url; img.width = f.w * scale; img.height = f.h * scale; }
  return img;
}

// ---------------------------------------------------------------- copy
const TIPS = {
  top: [['The letters look bumpable.', 'blocks'], ['Some keyboards know his name.', 'typename'], ['Press start. Or Enter. Same thing.', 'start']],
  about: [['That photo has more than one face.', 'portrait'], ['Cards have a back side. Try two quick taps on that photo.', 'secret'], ['Chef Zhuo keeps something in the pan.', 'zhuo'], ['Try every interest chip.', 'specialist']],
  education: [['Something sits between the two gates.', 'zerogap'], ['Locked doors like persistence.', 'thesis'], ['Inspect the badges.', null]],
  publications: [['Stars travel in pairs.', 'asterisk'], ['Water has a subscript.', 'h2o'], ['Reviewer #2 takes requests.', 'rebuttal']],
  experience: [['Some quests overlapped. Find when.', 'multithread'], ['The Lark logo looks like it could fly.', 'lark'], ['Voice-controlled teammates take orders.', 'teammate']],
  projects: [['The judge accepts eventually.', 'accepted'], ["Don't interrupt a boot.", 'panic'], ['Equip the whole set.', 'loadout'],
    ['Python looks like it could take more.', 'overfill'], ['One of those tools is famously hard to leave.', 'vimslot'], ['LaTeX has opinions about boxes.', 'tex']],
  contact: [['The mailbox has a flag.', 'mailbox'], ['Portals are nicer with the pointer on them.', 'portalhop'], ['Save often.', 'savepoint']],
};
const OUT = 'I am out of hints. Try the terminal: `';
const PER_SECTION = 3;

// ---------------------------------------------------------------- state
const html = document.documentElement;
const phone = () => matchMedia('(max-width: 719px)').matches;
const worldLive = () => !!world() && document.body.classList.contains('world-live');
let bit = null, hop = null, img = null;
let host = null, hostSec = null;
let pos = { x: 0, y: 0 };
let mode = 'perch'; // perch | row | gutter | bowl
let frames = null;
let tipsUsed = {};
let pets = 0;
let dozing = false, lastActive = performance.now(), zT = 0, blinkT = 0;
let say = null; // current bubble { el, close }
let returnT = 0, rowT = 0;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const barBottom = () => {
  const b = document.getElementById('bar')?.getBoundingClientRect().bottom ?? 60;
  const p = document.getElementById('phud');
  return Math.max(0, p && p.offsetHeight > 4 ? Math.max(b, p.getBoundingClientRect().bottom) : b);
};


// ---------------------------------------------------------------- build
function build() {
  frames = {
    open: frameUrls('bit')[0]?.url,
    step: frameUrls('bit')[1]?.url,
    shut: frameUrls('bit', (g) => { g[4] = '.BBBBBBBBBB.'; g[5] = '.BbbbBBbbbB.'; return g; }, 'shut')[0]?.url,
  };
  img = frameImg('bit', 3, 0, 'bit__img');
  hop = h('span', { class: 'bit__hop' }, h('span', { class: 'bit__bob' }, img));
  bit = h('button', { type: 'button', class: 'bit', 'data-game': '', 'aria-label': 'Bit, your companion. Pet or ask for a hint.' }, hop);
  let clickT = 0;
  bit.addEventListener('click', (e) => {
    wake();
    pet();
    clearTimeout(clickT);
    // a double-click bowls instead of talking: wait a beat before the tip (keyboard: no wait)
    if (e.detail === 0) tip();
    else clickT = setTimeout(tip, 240);
  });
  bit.addEventListener('dblclick', (e) => { e.preventDefault(); clearTimeout(clickT); bowl(); });
}

// ---------------------------------------------------------------- where Bit sits
function hostFor(cur) {
  if (!cur?.el) return null;
  if (cur.card) return cur.card;
  return cur.el.querySelector('.hero') || null;
}
/** Perch coordinates in the host's box (Bit's box is 44×42, feet at its bottom edge). */
function perchXY() {
  if (!host) return { x: 0, y: 0 };
  if (host.classList.contains('hero')) {
    const hr = host.getBoundingClientRect();
    const name = host.querySelector('.hero__name-t') || host.querySelector('.hero__name');
    if (name) {
      const r = name.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(name).fontSize) || 60;
      const x = Math.min(r.right - hr.left + 12, document.documentElement.clientWidth - 16 - 44 - hr.left);
      return { x, y: r.bottom - hr.top - fs * 0.24 - 42 };
    }
    return { x: 0, y: -44 };
  }
  const w = host.clientWidth;
  if (phone()) return { x: 12, y: -39 };
  return { x: w - 64 - 44, y: -39 };
}
function apply(x, y, { slide = true } = {}) {
  pos = { x, y };
  bit.style.transition = slide ? '' : 'none';
  bit.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  if (!slide) { void bit.offsetWidth; bit.style.transition = ''; }
}
function toPerch(slide = true) {
  mode = 'perch';
  bit.classList.remove('is-gutter');
  const p = perchXY();
  apply(p.x, p.y, { slide });
}

/** Move Bit to a new host with a FLIP arc (or a quick fade under reduced motion). */
function moveTo(cur, { animate = true } = {}) {
  const next = hostFor(cur);
  if (!next || !bit) return;
  if (next === host && bit.parentNode === host) { toPerch(); return; }
  closeSay();
  const before = bit.isConnected && bit.getClientRects().length ? bit.getBoundingClientRect() : null;
  host = next; hostSec = cur.el;
  host.classList.add('bit-host');
  host.append(bit);
  toPerch(false);
  if (!animate || !before || !isGame()) return;
  if (rm()) {
    hop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'linear' });
    return;
  }
  const after = bit.getBoundingClientRect();
  let dx = before.left - after.left, dy = before.top - after.top;
  // a far jump starts just off screen instead of flying past the whole page
  const lim = innerHeight * 0.9;
  if (Math.abs(dy) > lim) dy = Math.sign(dy) * lim;
  if (!after.width) return;
  const lift = 60 + Math.min(80, Math.abs(dx) * 0.1);
  img.src = frames.step;
  hop.animate([
    { transform: `translate(${dx}px, ${dy}px)` },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) rotate(${dx > 0 ? -12 : 12}deg)`, offset: 0.5 },
    { transform: 'translate(0, 0)' },
  ], { duration: 420, easing: 'cubic-bezier(.3,.1,.3,1)' }).onfinish = () => {
    img.src = frames.open;
    hop.animate([{ transform: 'scale(1.12, .84)' }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
  };
}

/** Slide along the top edge to above a row (desktop only; phones keep Bit docked). */
function slideToRow(row) {
  if (!bit || !host || !row || phone() || mode === 'bowl' || mode === 'gutter') return;
  if (!host.contains(row) || host.classList.contains('hero')) return;
  const hr = host.getBoundingClientRect(), rr = row.getBoundingClientRect();
  if (!rr.width) return;
  const x = clamp(rr.left + rr.width / 2 - hr.left - 22, 8, hr.width - 52);
  mode = 'row';
  apply(x, -39);
  clearTimeout(returnT);
}
function backSoon(ms = 1400) {
  clearTimeout(returnT);
  returnT = setTimeout(() => { if (mode === 'row') toPerch(); }, ms);
}

// ---------------------------------------------------------------- talking
function closeSay() {
  if (say) { say.close(); say = null; }
}
/** Is Bit (on its perch) fully on screen, with room for a short bubble beside it? */
function perchVisible() {
  if (!bit?.isConnected || !bit.getClientRects().length) return false;
  const r = bit.getBoundingClientRect();
  return r.top - 14 > barBottom() && r.bottom < innerHeight - 20 && r.right > 0 && r.left < innerWidth;
}
/** Room in the world-side gutter of the current card (desktop), or null. */
function gutterSpot() {
  if (!host || phone() || host.classList.contains('hero')) return null;
  const hr = host.getBoundingClientRect();
  const side = hostSec?.dataset.side === 'right' ? 'left' : 'right'; // the side the world is on
  const room = side === 'right' ? innerWidth - hr.right : hr.left;
  if (room < 300) return null;
  const vy = clamp(innerHeight * 0.42, barBottom() + 90, innerHeight - 80);
  const y = clamp(vy - hr.top, 20, hr.height - 60);
  const x = side === 'right' ? hr.width + 26 : -70;
  return { x, y, side };
}

function bubbleEl(who, text) {
  const el = h('div', { class: 'bubble bit-say', 'aria-hidden': 'true' });
  if (who && NPC_SPRITE[who]) el.append(h('span', { class: 'bubble__who', title: NPC_NAME[who] || who }, frameImg(NPC_SPRITE[who], 2)));
  el.append(h('span', { class: 'bubble__t' }, text));
  return el;
}
/** Place a bubble next to Bit, extending away from `dir` ('left' = grows leftwards). */
/** A bubble next to Bit (a child of Bit, so it follows a slide), growing towards `dir`. */
function showBubble(who, text, dir, ms) {
  closeSay();
  const el = bubbleEl(who, text);
  el.style.visibility = 'hidden';
  bit.append(el);
  const r = bit.getBoundingClientRect();
  const bw = el.offsetWidth, bh = el.offsetHeight;
  const W = document.documentElement.clientWidth;
  let x, y;
  if (r.top - bh - 10 > barBottom() + 4) {
    // above Bit, growing away from the card's inner side
    x = clamp(dir === 'left' ? r.right + 6 - bw : r.left - 6, 8, W - bw - 8);
    y = r.top - bh - 10;
    el.style.setProperty('--tx', `${clamp(r.left + r.width / 2 - x, 14, bw - 14)}px`);
    el.classList.add('bubble--above');
  } else {
    // no room above: beside Bit, feet-aligned, so it only covers the card's border and the gap above it
    x = dir === 'left' ? r.left - 10 - bw : r.right + 10;
    if (x < 8 || x + bw > W - 8) x = clamp(x, 8, W - bw - 8);
    y = Math.max(barBottom() + 4, r.bottom - bh);
    el.style.setProperty('--ty', `${clamp(r.top + r.height / 2 - y - 4, 10, bh - 14)}px`);
    el.classList.add(dir === 'left' ? 'bubble--side-l' : 'bubble--side-r');
  }
  el.style.left = `${Math.round(x - r.left)}px`;
  el.style.top = `${Math.round(y - r.top)}px`;
  el.style.visibility = '';
  requestAnimationFrame(() => el.classList.add('is-in'));
  let t = 0;
  const handle = {
    el,
    close() {
      clearTimeout(t);
      el.classList.remove('is-in'); el.classList.add('is-out');
      setTimeout(() => el.remove(), 220);
      if (say === handle) say = null;
    },
  };
  t = setTimeout(() => { handle.close(); if (mode === 'gutter') setTimeout(() => { if (!say && mode === 'gutter') toPerch(); }, 500); }, ms);
  say = handle;
  bit.classList.add('is-talk');
  setTimeout(() => bit?.classList.remove('is-talk'), 600);
  return handle;
}
function speechToast(who, text, ms) {
  const el = h('div', { class: 'egg-toast--info bit-toast' });
  const av = h('span', { class: 'toast__medal bit-toast__av', 'aria-hidden': 'true' }, frameImg(NPC_SPRITE[who] || 'bit', 2));
  el.append(av, h('div', null, h('div', { class: 'egg-toast__k' }, NPC_NAME[who] || 'Bit'), h('div', { class: 'egg-toast__t bit-toast__t' }, text)));
  pushToast(el, ms);
}

/**
 * Someone speaks on the page. Bit shows it: by its perch if that is on screen; otherwise it hops into
 * the world-side gutter next to where you are reading; on narrow screens as a small toast.
 * ambient lines (section intros) are dropped rather than shown out of place.
 */
export function speak(who, text, { ambient = false } = {}) {
  if (!bit || !isGame() || !text) return false;
  wake();
  const ms = clamp(2200 + text.length * 50, 3000, 7500);
  live(`${NPC_NAME[who] || 'Bit'}: ${text}`);
  const leftwards = !phone() && !host?.classList.contains('hero');
  if (mode !== 'gutter' && perchVisible()) { showBubble(who, text, leftwards ? 'left' : 'right', ms); return true; }
  if (ambient) return false;
  const g = gutterSpot();
  if (g && mode !== 'bowl') {
    mode = 'gutter';
    bit.classList.add('is-gutter');
    apply(g.x, g.y, { slide: false });
    if (!rm()) hop.animate([{ transform: 'translateY(-26px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
    showBubble(who, text, g.side === 'left' ? 'left' : 'right', ms);
    return true;
  }
  speechToast(who, text, ms + 800);
  return true;
}

// ---------------------------------------------------------------- pet, tips, bowl, doze
function pet() {
  if (!isGame()) return;
  sfx('buddy');
  burst(hop, { n: 4, kind: 'heart' });
  if (rm()) float(hop, '♥', { tone: 'red' });
  else hop.animate([{ transform: 'none' }, { transform: 'translateY(-7px) scale(1.06, .94)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
  emit('bit:pet');
  if (!worldLive() && ++pets >= 7) found('pet');
}
function tip() {
  if (!isGame() || !hostSec) return;
  const id = hostSec.id;
  const shown = tipsUsed[id] instanceof Set ? tipsUsed[id] : (tipsUsed[id] = new Set());
  const max = id === 'projects' ? 6 : PER_SECTION;
  const next = shown.size < max ? (TIPS[id] || []).find(([t, egg]) => !shown.has(t) && (!egg || !has(egg))) : null;
  const text = next ? next[0] : OUT;
  if (next) shown.add(next[0]);
  speak('bit', text);
}
function bowl() {
  if (!isGame() || !host || mode === 'bowl' || host.classList.contains('hero')) return;
  closeSay();
  const crit = host.querySelector('.critter:not(.is-dead)');
  const hr = host.getBoundingClientRect();
  let tx = 10, ty = 0;
  if (crit) {
    const cr = crit.getBoundingClientRect();
    tx = clamp(cr.left + cr.width / 2 - hr.left - 22, 0, hr.width - 44);
    ty = Math.max(0, cr.bottom - hr.top - 42 - pos.y - 4);
  }
  const dx = tx - pos.x;
  mode = 'bowl';
  bit.classList.add('is-bowl');
  sfx('swing');
  const hitCrit = () => { if (crit?.isConnected && !crit.classList.contains('is-dead')) crit.click(); };
  if (rm()) { hitCrit(); mode = 'perch'; bit.classList.remove('is-bowl'); return; }
  const dur = clamp(Math.abs(dx) * 1.6, 380, 900);
  const turns = Math.sign(dx || -1) * Math.max(1, Math.round(Math.abs(dx) / 90)) * 360;
  const go = hop.animate([
    { transform: 'none' },
    { transform: 'translateY(8px) scale(.9)', offset: 0.1 },
    { transform: `translate(${dx}px, ${ty}px) rotate(${turns}deg) scale(.9)` },
  ], { duration: dur, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' });
  go.onfinish = () => {
    hitCrit();
    sfx('hit');
    const back = hop.animate([
      { transform: `translate(${dx}px, ${ty}px) rotate(${turns}deg) scale(.9)` },
      { transform: `translate(${dx * 0.5}px, ${ty * 0.5 - 40}px) rotate(${turns / 2}deg)`, offset: 0.5 },
      { transform: 'none' },
    ], { duration: 520, easing: 'cubic-bezier(.3,.1,.3,1)' });
    back.onfinish = () => { go.cancel(); mode = 'perch'; bit.classList.remove('is-bowl'); toPerch(); };
  };
}

function doze() {
  if (dozing || !bit || !isGame() || document.hidden) return;
  dozing = true;
  bit.classList.add('is-doze');
  img.src = frames.shut;
  if (!worldLive()) found('sleep');
  const zz = () => {
    if (!dozing) return;
    if (!document.hidden && bit.getClientRects().length) float(hop, 'z', { tone: 'teal' });
    zT = setTimeout(zz, 2400);
  };
  zz();
}
function wake() {
  lastActive = performance.now();
  if (!dozing) return;
  dozing = false;
  clearTimeout(zT);
  bit.classList.remove('is-doze');
  img.src = frames.open;
  if (!rm()) hop.animate([{ transform: 'none' }, { transform: 'translateY(-10px)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
}
function blinkLoop() {
  clearTimeout(blinkT);
  blinkT = setTimeout(() => {
    if (bit && !dozing && !document.hidden && isGame()) {
      img.src = frames.shut;
      setTimeout(() => { if (!dozing) img.src = frames.open; }, 140);
    }
    blinkLoop();
  }, 3000 + Math.random() * 3000);
}

// ---------------------------------------------------------------- boot
export function init(ctx) {
  if (bit) return;
  build();

  // speech fallback: every kit.say that the world did not take
  on('ui:say', (p) => {
    if (!p || p.handled || !isGame() || html.classList.contains('is-play')) return;
    if (speak(p.who, p.text)) p.handled = true;
  });

  // follow the chapter
  let first = true;
  const spoken = new Set();
  onSection((cur) => {
    if (!cur) return;
    const wasFirst = first;
    moveTo(cur, { animate: !first });
    first = false;
    // without the world, the section's own line is spoken here (once per section per session; if the
    // perch is not on screen yet the line waits for the next visit instead of popping up elsewhere)
    const line = cur.el?.dataset.say;
    if (!line) return;
    setTimeout(() => {
      if (currentSection()?.el !== cur.el || worldLive() || !isGame() || spoken.has(cur.id) || say) return;
      const m = /^\s*(\w+)\s*:\s*(.+)$/.exec(line);
      if (m && speak(m[1], m[2], { ambient: true }) && sessionOnce(`bit-say:${cur.id}`)) spoken.add(cur.id);
    }, wasFirst ? 1800 : 900);
  });

  // rows: Bit comes over
  document.addEventListener('pointerover', (e) => {
    const row = e.target instanceof Element ? e.target.closest('[data-focus]') : null;
    if (!row || !host?.contains(row)) return;
    clearTimeout(rowT);
    rowT = setTimeout(() => slideToRow(row), 120);
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const row = e.target instanceof Element ? e.target.closest('[data-focus]') : null;
    if (!row || (e.relatedTarget instanceof Element && row.contains(e.relatedTarget))) return;
    clearTimeout(rowT);
    backSoon();
  }, { passive: true });
  document.addEventListener('focusin', (e) => {
    const row = e.target instanceof Element ? e.target.closest('[data-focus]') : null;
    if (row && host?.contains(row)) slideToRow(row);
  });
  on('bit:goto', (el) => { if (el) { slideToRow(el); backSoon(4000); } });
  on('pick', ({ id } = {}) => {
    const row = id && document.querySelector(`[data-focus="${id}"]`);
    if (row) setTimeout(() => { slideToRow(row); backSoon(3000); }, 700);
  });

  // idle → doze; any activity wakes
  const act = () => { lastActive = performance.now(); if (dozing) wake(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, act, { passive: true }));
  addEventListener('scroll', act, { passive: true });
  let lastMove = 0;
  addEventListener('pointermove', () => { const t = performance.now(); if (t - lastMove > 500) { lastMove = t; act(); } }, { passive: true });
  setInterval(() => { if (!document.hidden && performance.now() - lastActive > 60000) doze(); }, 5000);
  blinkLoop();

  // resize: sit back down properly
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (host && mode !== 'bowl') toPerch(false); }, 150); });
  // mode changes (Reviewer mode off again, reduced motion toggled)
  ctx?.mode?.onMode?.(() => { if (host) toPerch(false); });
  // the 3D play mode hides the page: no talking into the void
  on('mode', (m) => { if (m === 'play') closeSay(); });
}
