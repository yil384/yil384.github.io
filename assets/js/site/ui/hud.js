// The status strip (SPEC §2.4): a second row inside header#bar, so it never floats over a card.
// Lv chip · HP (always full; nothing here hurts) · FOCUS (fills while you read) · PROGRESS with six
// chapter pips and a joke paper status · Triton Cash. Level-ups slide a ribbon out of the Lv chip.
import { on } from '../../game3d/bus.js';
import { found } from '../eggs.js';
import { openNotes } from '../notes.js';
import { P, save } from './pstate.js';
import * as progress from './progress.js';
import { $, $$, bubble, toast, clicks, observe, onSection, sfx, rm } from './kit.js';

const CHAPTERS = [
  { id: 'about', shot: 'about', name: 'About' },
  { id: 'education', shot: 'edu', name: 'Education' },
  { id: 'publications', shot: 'library', name: 'Publications' },
  { id: 'experience', shot: 'trail', name: 'Experience' },
  { id: 'projects', shot: 'workshop', name: 'Projects' },
  { id: 'contact', shot: 'meadow', name: 'Contact' },
];
export { CHAPTERS };
const STATUS = [[0, 'Draft'], [0.2, 'Submitted'], [0.4, 'Under review'], [0.6, 'Rebuttal'], [0.8, 'Accepted'], [0.995, 'Camera-ready']];

let els = null;
let focus = 0;
let flashT = 0;
let current = '';
let started = false;

/** Element to fly things into: 'cash' | 'xp' | 'lv' | 'eggs' (falls back to what is visible on phones). */
export function target(name) {
  const phone = matchMedia('(max-width: 719px)').matches;
  if (name === 'eggs') return $('#eggs-btn');
  if (phone) return $('#bar-lv');
  if (name === 'cash') return $('#phud-cash');
  return $('#phud-lv');
}
/** Show a temporary string in the cash counter (the NaN Slime gag). */
export function flash(text, ms = 1200) {
  if (!els) return;
  clearTimeout(flashT);
  els.cashN.textContent = text;
  els.cash.classList.add('is-flash');
  flashT = setTimeout(() => { els.cash.classList.remove('is-flash'); renderCash(); }, Math.max(800, Math.min(1500, ms)));
}
export function refillFocus() { focus = 100; P.focus = 100; renderFocus(); pulse('focus'); }
export function pulse(name) {
  const el = name === 'focus' ? els?.focus : name === 'hp' ? els?.hp : target(name);
  if (!el) return;
  el.classList.remove('is-pulse'); void el.offsetWidth; el.classList.add('is-pulse');
  setTimeout(() => el.classList.remove('is-pulse'), 700);
}
export const hud = { target, flash, refillFocus, pulse };

function renderLv(st = progress.state()) {
  const { level, title, xp, next, frac } = st;
  els.lvN.textContent = `Lv ${level}`;
  els.lvT.textContent = title;
  els.lvXp.style.setProperty('--v', frac.toFixed(3));
  const lo = progress.THRESHOLDS[level - 1];
  const label = next == null ? `Level ${level}, ${title}, ${xp} XP, the top level. Open progress.` : `Level ${level}, ${title}, ${xp - lo} of ${next - lo} XP. Open progress.`;
  els.lv.setAttribute('aria-label', label);
  els.lv.title = `${xp} XP${next != null ? ` · next level at ${next}` : ''}`;
  if (els.barLv) {
    els.barLv.querySelector('.bar__lv-n').textContent = `Lv${level}`;
    els.barLv.setAttribute('aria-label', label);
    els.barLv.style.setProperty('--v', frac.toFixed(3));
  }
}
function renderCash() {
  if (!els || els.cash.classList.contains('is-flash')) return;
  els.cashN.textContent = progress.cash();
  els.cash.setAttribute('aria-label', `Triton Cash: ${progress.cash()}. Open progress.`);
}
function renderFocus() {
  els.focusI.style.setProperty('--v', (focus / 100).toFixed(2));
  els.focus.title = `Focus ${Math.round(focus)}/100. Fills while you read.`;
}

function levelRibbon(level, title) {
  const r = els.ribbon;
  r.textContent = `Level up · Lv ${level} · ${title}`;
  r.classList.remove('is-on'); void r.offsetWidth; r.classList.add('is-on');
  pulse('lv');
  setTimeout(() => r.classList.remove('is-on'), 1900);
}

// ---- chapter pips
function buildPips() {
  els.pips.replaceChildren(...CHAPTERS.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'phud__pip';
    b.dataset.id = c.id;
    b.dataset.shot = c.shot;
    b.addEventListener('click', () => document.getElementById(c.id)?.scrollIntoView({ behavior: rm() ? 'auto' : 'smooth', block: 'start' }));
    b.append(Object.assign(document.createElement('span'), { className: 'sr', textContent: `Chapter ${i + 1}` }));
    return b;
  }));
  renderPips();
  placePips();
}
function placePips() {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  for (const b of els.pips.children) {
    const sec = document.getElementById(b.dataset.id);
    if (!sec) continue;
    const f = Math.max(0, Math.min(1, (sec.offsetTop - innerHeight * 0.2) / max));
    b.style.setProperty('--x', f.toFixed(4));
  }
}
function renderPips() {
  CHAPTERS.forEach((c, i) => {
    const b = els.pips.children[i];
    if (!b) return;
    const cleared = !!P.cleared[c.shot];
    const isCur = current === c.id;
    b.classList.toggle('is-cleared', cleared);
    b.classList.toggle('is-current', isCur);
    b.setAttribute('aria-label', `Chapter ${i + 1} · ${c.name}${cleared ? ', cleared' : isCur ? ', you are here' : ''}`);
  });
}

// ---- focus meter: +1/s while a card is on screen and the tab is visible; −1 per 4s while hidden
const onScreen = new Set();
let hiddenAt = 0;
let deepDone = false;
function focusTick() {
  if (document.hidden) return;
  P.stats.ms = (P.stats.ms | 0) + 1000;
  if (!onScreen.size || focus >= 100) return;
  focus = Math.min(100, focus + 1);
  P.focus = focus;
  renderFocus();
  if (focus >= 100 && !deepDone) {
    deepDone = true;
    pulse('focus');
    sfx('heal');
    toast('Deep focus', 'The page is yours.', { kind: 'info', k: 'Focus 100' });
    progress.award({ id: 'deepfocus', xp: 25, why: 'Deep focus', from: els.focus });
  }
}

export function initHud() {
  if (started) return hud;
  started = true;
  const root = $('#phud');
  if (!root) return hud;
  els = {
    root, lv: $('#phud-lv'), lvN: $('.phud__lvn', root), lvT: $('.phud__title', root), lvXp: $('.phud__xp i', root),
    hp: $('#phud-hp'), focus: $('#phud-focus'), focusI: $('#phud-focus .phud__track i'), pips: $('#phud-pips'), status: $('#phud-status'),
    cash: $('#phud-cash'), cashN: $('#phud-cash-n'), ribbon: $('#phud-ribbon'), barLv: $('#bar-lv'),
  };
  focus = Math.max(0, Math.min(100, P.focus | 0));

  renderLv(); renderCash(); renderFocus(); buildPips();
  progress.onProgress((st) => {
    renderLv(progress.state());
    renderCash();
    renderPips();
    if (st.leveled) levelRibbon(st.level, st.title);
  });
  const toNotes = () => openNotes({ tab: 'progress' });
  els.lv.addEventListener('click', toNotes);
  els.cash.addEventListener('click', toNotes);
  els.barLv?.addEventListener('click', toNotes);
  els.hp.addEventListener('click', () => { pulse('hp'); sfx('heal'); });
  clicks(els.hp, 5, 4000, () => { found('invincible'); bubble(els.hp, 'God mode was on the whole time.', { place: 'below', who: 'bit' }); });

  // progress (director 'progress' events; chrome's scroll spy emits the same without the world)
  let lastStatus = '';
  on('progress', (p) => {
    let s = STATUS[0][1];
    for (const [at, label] of STATUS) if (p >= at) s = label;
    if (s !== lastStatus) { lastStatus = s; els.status.textContent = s; }
  });
  onSection((sec) => {
    current = sec?.id || '';
    renderPips();
  });

  // focus
  for (const card of $$('main .card')) observe(card, { threshold: 0.5, once: false }, (_e, ok) => { if (ok) onScreen.add(card); else onScreen.delete(card); });
  setInterval(focusTick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); save(); return; }
    if (hiddenAt) {
      const lost = Math.floor((performance.now() - hiddenAt) / 4000);
      if (lost > 0) { focus = Math.max(0, focus - lost); P.focus = focus; renderFocus(); }
      hiddenAt = 0;
    }
  });

  addEventListener('resize', placePips);
  if (typeof ResizeObserver !== 'undefined') {
    let q = 0;
    new ResizeObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(placePips); }).observe(document.getElementById('page') || document.body);
  }
  return hud;
}
