// Page keys (SPEC §2.8). The existing keys stay where they are (` terminal, W/A/S/D and Konami in
// eggs-dom.js). Ignored while typing, while the terminal / Field Notes / a modal is open, and while the
// 3D play mode owns the keyboard. Other modules add keys with registerKey (B bonk, P walk…).
import { found } from '../eggs.js';
import { $, $$, h, isEditable, world, rm, isGame, currentSection, dispatchPrimary, sfx } from './kit.js';
import { togglePlain } from './mode.js';

const registry = new Map(); // key → [{ fn, when }]
let started = false;
let sheet = null;
let sheetPrev = null;

/** Add a key. when(e) → boolean decides if it applies now (default: game mode only). Returns a remover. */
export function registerKey(key, fn, { when } = {}) {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (!registry.has(k)) registry.set(k, []);
  const rec = { fn, when: when || (() => isGame()) };
  registry.get(k).push(rec);
  return () => { const a = registry.get(k); const i = a.indexOf(rec); if (i >= 0) a.splice(i, 1); };
}

const blocked = () => !!document.querySelector('.notes.is-open, .term.is-open') || document.documentElement.classList.contains('modal-open');
const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
const behavior = () => (rm() ? 'auto' : 'smooth');

// ---- J / K: next / previous item the world points at
function focusItems() { return $$('main [data-focus]').filter(visible); }
function stepItem(dir) {
  const items = focusItems();
  if (!items.length) return;
  const act = document.activeElement?.closest?.('[data-focus]');
  let i = items.indexOf(act);
  if (i < 0) {
    const mid = innerHeight / 2;
    let best = 0, bd = Infinity;
    items.forEach((el, j) => { const r = el.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = j; } });
    const r = items[best].getBoundingClientRect();
    i = dir > 0 ? (r.top + r.height / 2 > mid + 4 ? best - 1 : best) : (r.top + r.height / 2 < mid - 4 ? best + 1 : best);
  }
  const next = items[Math.max(0, Math.min(items.length - 1, i + dir))];
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'center', behavior: behavior() });
  found('vimnav');
}

// ---- [ / ]: chapters
function stepChapter(dir) {
  const secs = $$('main section[data-shot]');
  const cur = currentSection()?.el;
  let i = secs.indexOf(cur);
  if (i < 0) i = 0;
  const next = secs[Math.max(0, Math.min(secs.length - 1, i + dir))];
  if (!next) return;
  next.scrollIntoView({ block: 'start', behavior: behavior() });
  const focusable = next.querySelector('h2, h1');
  if (focusable) { focusable.tabIndex = -1; focusable.focus({ preventScroll: true }); }
}

// ---- ? controls sheet
const ROWS = [
  [['J', 'K'], 'next / previous item'],
  [['[', ']'], 'previous / next chapter'],
  [['E'], 'action on the focused item'],
  [['C'], 'copy BibTeX (on a paper)'],
  [['B'], 'bonk the nearest critter'],
  [['R'], 'Reviewer mode (plain CV)'],
  [['W'], 'take control of the scholar'],
  [['`'], 'terminal'],
  [['?'], 'this sheet'],
  [['Esc'], 'close'],
];
function buildSheet() {
  sheet = $('#keys-sheet');
  if (!sheet) return null;
  sheet.replaceChildren(
    h('div', { class: 'keys-sheet__head' }, h('p', { class: 'keys-sheet__t' }, 'Controls'), h('button', { type: 'button', class: 'keys-sheet__x', 'aria-label': 'Close controls', onclick: () => toggleSheet(false) }, '×')),
    h('dl', { class: 'keys-sheet__list' }, ...ROWS.map(([ks, what]) => h('div', null, h('dt', null, ...ks.map((k) => h('kbd', null, k))), h('dd', null, what)))),
    h('p', { class: 'keys-sheet__foot' }, 'Everything also works with a mouse or a tap.'),
  );
  sheet.classList.add('keys-sheet');
  sheet.tabIndex = -1;
  return sheet;
}
export function toggleSheet(on) {
  if (!sheet && !buildSheet()) return;
  const open = on == null ? sheet.hidden : on;
  if (open) {
    sheetPrev = document.activeElement;
    sheet.hidden = false;
    sheet.focus({ preventScroll: true });
    sfx('open');
    found('manual');
  } else if (!sheet.hidden) {
    sheet.hidden = true;
    sheetPrev?.focus?.({ preventScroll: true });
  }
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { if (sheet && !sheet.hidden) { toggleSheet(false); e.preventDefault(); } return; }
  if (isEditable(e.target) || blocked()) return;
  if (world()?.playing) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // registered keys first (sections, companions)
  const recs = registry.get(k);
  if (recs) {
    for (let i = recs.length - 1; i >= 0; i--) {
      if (recs[i].when(e)) { if (recs[i].fn(e) !== false) { e.preventDefault(); return; } }
    }
  }
  if (e.repeat && (k === 'r' || k === '?')) return;
  switch (k) {
    case 'r': e.preventDefault(); togglePlain(); return;
    case '?': e.preventDefault(); toggleSheet(); return;
    case 'j': e.preventDefault(); stepItem(1); return;
    case 'k': e.preventDefault(); stepItem(-1); return;
    case ']': e.preventDefault(); stepChapter(1); return;
    case '[': e.preventDefault(); stepChapter(-1); return;
    case 'e': {
      if (!isGame()) return;
      const item = document.activeElement?.closest?.('[data-focus]');
      if (item) { e.preventDefault(); dispatchPrimary(item); }
      return;
    }
    case 'c': {
      const item = document.activeElement?.closest?.('.pub');
      if (!item) return;
      e.preventDefault();
      if (!dispatchPrimary(item, 'ui:copy')) item.querySelector('[data-copy]')?.click();
      return;
    }
    default:
  }
}

export function initKeys() {
  if (started) return;
  started = true;
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', (e) => {
    if (!sheet || sheet.hidden) return;
    if (!sheet.contains(e.target)) toggleSheet(false);
  });
}
