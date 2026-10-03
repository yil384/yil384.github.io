// The portrait's other face: a single click on #portrait swaps the photo for the minifigure version
// (assets/img/portrait-lego.webp) and back. The minifigure is built brick by brick: a grid of bricks cut from
// it drops in row by row from the bottom and snaps into place; going back, its bricks pop off from the top and
// tumble out of the frame, revealing the photo. Page-level: no WebGL, works in Reviewer mode and on phones;
// html.rm crossfades instead. eggs-dom.js counts the clicks (one = this, two = the flip, five = the voxel egg).
// Nothing is fetched before the pointer (or focus) reaches the portrait.
import { sfx } from '../game3d/audio.js';
import { h, live } from './ui/kit.js';

export const LEGO = 'assets/img/portrait-lego.webp';   // square, like the slot it fills
const N = 5;                    // bricks per side
const ROW_MS = 85;              // stagger between rows
const DROP_MS = 400, POP_MS = 520, FADE_MS = 220;
const ALT = { photo: 'Yichen Lin', lego: 'Yichen Lin as a LEGO minifigure' };
const LABEL = { photo: 'Photo of Yichen Lin', lego: 'Yichen Lin as a LEGO minifigure' };

const html = document.documentElement;
const reduced = () => html.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * photo: the photo's URL (the img's original src). onDone(face) runs when a swap lands.
 * Returns { toggle, settle, src, face }.
 */
export function initPortraitSwap(portrait, { photo, onDone } = {}) {
  const img = portrait.querySelector('img');
  let face = 'photo';     // the face showing, or the one being built (the <img> has it once the bricks are gone)
  let run = null;         // the swap in progress: { finish() }
  let seq = 0;
  const ready = {};

  // decode ahead so the bricks never show an empty frame
  const load = (src) => (ready[src] ||= new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(res);
    im.onerror = () => { delete ready[src]; rej(new Error(`could not load ${src}`)); };
    im.src = src;
  }));
  const warm = () => { load(LEGO).catch(() => {}); };
  for (const ev of ['pointerenter', 'pointerdown', 'focus']) portrait.addEventListener(ev, warm, { once: true });

  const label = (f) => {
    img.alt = ALT[f];
    portrait.setAttribute('aria-label', LABEL[f]);
  };

  // the brick grid: every brick shows its own piece of the minifigure (square image, so plain percentages).
  // Higher rows sit on top: they are the ones still moving while the lower rows rest (both ways).
  function bricks() {
    const wall = h('span', { class: 'portrait__bricks', 'aria-hidden': 'true' });
    const out = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const b = h('i', { style: `z-index:${N - r};background-image:url("${LEGO}");background-size:${N * 100}% ${N * 100}%;background-position:${(c / (N - 1)) * 100}% ${(r / (N - 1)) * 100}%` });
        wall.append(b);
        out.push({ b, r, c });
      }
    }
    return { wall, out };
  }

  async function toggle() {
    settle();
    if (!img) return;
    const to = face === 'lego' ? 'photo' : 'lego';
    const my = ++seq;
    try { await Promise.all([load(LEGO), load(photo)]); } catch (err) { console.warn('[portrait] swap:', err.message); return; }
    if (my !== seq || portrait.classList.contains('is-voxel')) return;
    face = to;
    label(to);
    live(to === 'lego' ? 'The photo is now a minifigure.' : 'Back to the photo.');
    const rm = reduced();
    const { wall, out } = bricks();
    if (rm) wall.classList.add('is-flat');
    const anims = [], timers = [];
    let done = false;
    // the underlying <img> takes the new face before the bricks leave (built: at the end; taken apart: at once)
    const land = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      if (to === 'lego') img.src = LEGO;
      wall.remove();
      run = null;
      onDone?.(to);
    };
    run = { finish: land };

    if (to === 'lego') {
      portrait.append(wall);
      if (rm) {
        anims.push(wall.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }));
      } else {
        for (const { b, r, c } of out) {
          const k = N - 1 - r;   // bottom row first
          const delay = k * ROW_MS + ((c * 37 + r * 11) % 5) * 12;
          // each brick comes down onto its slot from just above (and nearer the viewer), then presses in
          anims.push(b.animate([
            { transform: 'translateY(-70%) scale(1.35)', opacity: 0, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
            { opacity: 1, offset: 0.35 },
            { transform: 'translateY(4%) scale(0.95)', opacity: 1, offset: 0.75, easing: 'ease-out' },
            { transform: 'none', opacity: 1 },
          ], { duration: DROP_MS, delay, fill: 'both' }));
        }
        for (let k = 0; k < N; k++) timers.push(setTimeout(() => sfx('snap'), k * ROW_MS + DROP_MS * 0.75));
      }
      Promise.all(anims.map((a) => a.finished)).then(async () => {
        if (done) return;
        img.src = LEGO;
        try { await img.decode?.(); } catch { /* shown on load anyway */ }
        if (done) return;
        wall.classList.add('is-set');   // studs and seams fade, the bricks become the picture
        timers.push(setTimeout(land, rm ? 0 : FADE_MS));
      }, () => {});
    } else {
      // the bricks start as an exact copy of the minifigure, the photo goes in underneath
      wall.classList.add('is-set');
      portrait.append(wall);
      img.src = photo;
      try { await img.decode?.(); } catch { /* fine */ }
      if (done) return;
      if (rm) {
        anims.push(wall.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' }));
      } else {
        wall.classList.remove('is-set');   // seams show: it is bricks after all
        for (const { b, r, c } of out) {
          const delay = 60 + r * ROW_MS + ((c * 29 + r * 7) % 5) * 14;   // top row first
          const dx = (c - (N - 1) / 2) * 34 + (((c * 13 + r * 5) % 7) - 3) * 8;
          const rot = (((c * 17 + r * 23) % 9) - 4) * 9;
          anims.push(b.animate([
            { transform: 'none', opacity: 1, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
            { transform: `translate(${dx * 0.25}%, -16%) rotate(${rot * 0.2}deg)`, opacity: 1, offset: 0.22, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
            { transform: `translate(${dx}%, ${(N - r + 0.6) * 100}%) rotate(${rot}deg)`, opacity: 0 },
          ], { duration: POP_MS, delay, fill: 'both' }));
        }
        for (let r = 0; r < N; r++) timers.push(setTimeout(() => sfx('snap'), 60 + r * ROW_MS));
      }
      Promise.all(anims.map((a) => a.finished)).then(land, () => {});
    }
  }

  // jump to the end of a running swap (another click, the flip, the voxel egg); one still loading is dropped
  function settle() {
    seq++;
    run?.finish();
  }

  return { toggle, settle, src: () => (face === 'lego' ? LEGO : photo), face: () => face };
}
