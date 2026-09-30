// Modes on <html> (SPEC §2.1). is-game: scripts running, not Reviewer mode, not printing. is-plain:
// Reviewer mode, a clean one-column CV with every extra detail open and the game hidden. rm: reduced
// motion (the OS setting or the Field Notes toggle). The early inline script in index.html sets the
// first state before paint; this module owns every change after that.
import { emit } from '../../game3d/bus.js';
import { found } from '../eggs.js';
import { P, save } from './pstate.js';
import { $, $$, live, world, currentSection } from './kit.js';

const html = document.documentElement;
const q = new URLSearchParams(location.search);
const forced = q.get('plain') === '1' || q.get('mode') === 'cv';
const listeners = new Set();
let printing = false;
let plain = html.classList.contains('is-plain');
let closedBefore = null;
let started = false;

export const isPlain = () => plain;
export const onMode = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => { const st = { plain, game: html.classList.contains('is-game'), rm: html.classList.contains('rm') }; listeners.forEach((f) => { try { f(st); } catch (err) { console.error('[mode]', err); } }); };

function applyClasses() {
  const eff = plain || printing;
  html.classList.toggle('is-plain', eff);
  html.classList.toggle('is-game', !eff);
}

function openDetails(on) {
  const all = $$('details.more');
  if (on) {
    if (!closedBefore) closedBefore = all.filter((d) => !d.open);
    all.forEach((d) => { d.open = true; });
  } else if (closedBefore) {
    closedBefore.forEach((d) => { d.open = false; });
    closedBefore = null;
  }
}

function renderButton() {
  const b = $('#plain-btn');
  if (!b) return;
  b.setAttribute('aria-pressed', String(plain));
  const l = b.querySelector('.bar__plain-l');
  if (l) l.textContent = plain ? 'Play mode' : 'Reviewer mode';
  b.title = plain ? 'Back to the interactive page (R)' : 'Reviewer mode: a plain one-column CV (R)';
  const img = b.querySelector('img');
  if (img) img.src = `assets/icons/ui/${plain ? 'gamepad-2' : 'book-open'}.svg`;
}

/** Switch Reviewer mode on or off. Keeps the reader's place (the current section stays in view). */
export function setPlain(on, { persist = true, announce = true } = {}) {
  on = !!on;
  if (on === plain) { renderButton(); return; }
  const sec = currentSection()?.el;
  const top = sec ? sec.getBoundingClientRect().top : 0;
  plain = on;
  if (persist && !forced) { P.plain = on; save(); }
  if (on && world()?.playing) { try { world().exitPlay(); } catch { /* not in play */ } }
  applyClasses();
  openDetails(on);
  renderButton();
  emit('page:plain', on);
  if (announce) live(on ? 'Reviewer mode on: plain CV, game hidden.' : 'Play mode on.');
  if (on) found('reviewermode');
  // keep the same section under the reader's eyes after the layout change
  if (sec) requestAnimationFrame(() => { const r = sec.getBoundingClientRect(); window.scrollBy({ top: r.top - Math.min(top, 80), behavior: 'instant' }); });
  notify();
}
export const togglePlain = () => setPlain(!plain);

// ---- reduced motion
const mq = matchMedia('(prefers-reduced-motion: reduce)');
function applyRm() { html.classList.toggle('rm', mq.matches || !!P.rm); }
export function setRm(on) { P.rm = !!on; save(); applyRm(); notify(); }
export const isRm = () => html.classList.contains('rm');

export function initMode() {
  if (started) return;
  started = true;
  // the inline script may have read a stale flag; this module is the source of truth now
  plain = forced || (!!P.plain && q.get('plain') !== '0');
  applyClasses();
  applyRm();
  mq.addEventListener?.('change', () => { applyRm(); notify(); });
  if (plain) openDetails(true);
  renderButton();
  $('#plain-btn')?.addEventListener('click', togglePlain);
  // printing always gets the clean CV, with every detail open
  let printedOpen = false;
  addEventListener('beforeprint', () => {
    printing = true;
    if (!plain) { openDetails(true); printedOpen = true; }
    applyClasses();
  });
  addEventListener('afterprint', () => {
    printing = false;
    if (printedOpen) { openDetails(false); printedOpen = false; }
    applyClasses();
  });
}
