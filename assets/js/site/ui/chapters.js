// Chapters (SPEC §2.3): a section is *read* once ≥50% of its card has been on screen for 3 s
// (cumulative, paused while the tab is hidden). Reading clears the chapter: +10 XP, a CLEARED seal in
// the card's seal slot, a filled HUD pip and page:clear for the world. All six → the `cleared` egg.
// Also remembers the last section for the hero's "Continue".
import { emit } from '../../game3d/bus.js';
import { found } from '../eggs.js';
import { P, save } from './pstate.js';
import * as progress from './progress.js';
import { $, $$, h, dwell, onSection, bubble, sfx, rm, isGame } from './kit.js';

export const CHAPTER_SHOTS = ['about', 'edu', 'library', 'trail', 'workshop', 'meadow'];
const bornAt = performance.now();
let started = false;

const fmtDate = (t) => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`; };
const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Put the CLEARED seal into a section's slot. animate=false for seals restored from the save. */
function seal(shot, animate) {
  const slot = $(`.seal-slot[data-seal="${shot}"]`);
  if (!slot || slot.querySelector('.seal')) return;
  const when = P.cleared[shot] || Date.now();
  const el = h('button', { type: 'button', class: 'seal', tabindex: '-1', 'aria-hidden': 'true', title: `Chapter cleared ${fmtDate(when)}` },
    h('span', { class: 'seal__ring' }),
    h('span', { class: 'seal__t' }, 'Cleared'),
    h('span', { class: 'seal__d' }, fmtDate(when)));
  el.addEventListener('click', () => {
    el.classList.remove('is-wobble'); void el.offsetWidth; el.classList.add('is-wobble');
    sfx('stamp');
    bubble(el, `Cleared in ${fmtDur(P.read[shot] ? P.read[shot] : performance.now() - bornAt)}`, { place: 'below', who: 'bit' });
  });
  slot.replaceChildren(el);
  if (animate && !rm()) { el.classList.add('is-thump'); sfx('stamp'); }
}

export function clear(shot) {
  if (!shot || P.cleared[shot]) return false;
  P.cleared[shot] = Date.now();
  P.read[shot] = Math.round(performance.now() - bornAt);
  save();
  const n = CHAPTER_SHOTS.indexOf(shot) + 1;
  const slot = $(`.seal-slot[data-seal="${shot}"]`);
  seal(shot, isGame());
  progress.award({ id: `read:${shot}`, xp: 10, why: `Read §${n}`, from: isGame() ? slot : null });
  emit('page:clear', { shot });
  if (CHAPTER_SHOTS.every((s) => P.cleared[s])) found('cleared');
  progress.refresh();
  return true;
}

export function initChapters() {
  if (started) return;
  started = true;
  // seals already earned (earlier visits): shown at rest
  for (const s of CHAPTER_SHOTS) if (P.cleared[s]) seal(s, false);
  for (const sec of $$('main section[data-shot]')) {
    const shot = sec.dataset.shot;
    if (!CHAPTER_SHOTS.includes(shot) || P.cleared[shot]) continue;
    const card = sec.querySelector(':scope > .card');
    if (card) dwell(card, 3000, () => clear(shot));
  }
  onSection((cur) => {
    if (!cur?.id) return;
    P.lastSection = cur.id;
    P.lastVisit = Date.now();
    save();
  });
  // New Game+: seals come off
  progress.onProgress((st) => {
    if (!st.reset) return;
    $$('.seal-slot').forEach((s) => s.replaceChildren());
    for (const sec of $$('main section[data-shot]')) {
      const shot = sec.dataset.shot, card = sec.querySelector(':scope > .card');
      if (card && CHAPTER_SHOTS.includes(shot)) dwell(card, 3000, () => clear(shot));
    }
  });
}
