// On-screen controls for touch screens (pointer: coarse), shown only in play mode.
//   left side    a floating joystick: put your thumb down anywhere on the left and push (to the rim = sprint)
//   right side   drag anywhere to look around, pinch to zoom, tap a name plate to talk
//   buttons      attack, jump (hold: higher jump, glide, climb while flying), use (E, lights up when
//                something is in reach), dodge, spell (tap: cast, hold: pick a spell), down (while flying)
//   top row      map, vehicle, view (first / third person), menu (everything else, and back to the page)
// The whole screen is one gesture surface (touch-action: none), so a thumb that lands a little off a
// control never scrolls, zooms or selects the page underneath.
// Everything feeds the same input channels as the keyboard (input.stick, setVirtual, addDrag, addWheel).
import { h, icon } from './util.js';

const capture = (el, id) => { try { el.setPointerCapture?.(id); } catch { /* pointer already gone */ } };
const R = 52;                 // joystick travel (px)
const HOLD_MS = 330;          // long-press on the spell button opens the picker
const TAP_MS = 280, TAP_PX = 12;

/**
 * @param {HTMLElement} root  the play HUD
 * @param {object} input      input.js api
 * @param {object} act        { attack, interact, spell(id), signature, vehicle, map, view, menu }
 * @param {object} opts       { spells: { id: { name, icon, mp } }, spell: current id, onSpell(id) }
 */
export function createTouch(root, input, act, opts = {}) {
  const spells = opts.spells || {};
  let current = spells[opts.spell] ? opts.spell : Object.keys(spells)[0];
  const el = h('div', { class: 'touch', 'aria-hidden': 'true' });
  const pad = h('div', { class: 'touch__pad' });
  const knob = h('span', { class: 'touch__knob' });
  const stick = h('div', { class: 'touch__stick' }, knob);

  const btn = (cls, label, ic, down, up = null) => {
    const b = h('button', { type: 'button', class: `touch__btn touch__btn--${cls}`, 'aria-label': label, tabindex: '-1' }, ic ? icon(ic, { size: 24 }) : null);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); capture(b, e.pointerId); b.classList.add('is-down'); down?.(e); });
    const release = (e) => { if (!b.classList.contains('is-down')) return; b.classList.remove('is-down'); up?.(e); };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const text = (b, t) => { b.append(h('b', null, t)); return b; };

  // ---- spell: tap casts the current spell, hold opens the picker (spells + the companion's move)
  let holdT = 0, held = false;
  const spellBtn = btn('spell', 'Spell (hold to choose)', spells[current]?.icon || 'fireball',
    () => { held = false; clearTimeout(holdT); holdT = setTimeout(() => { held = true; openPicker(); }, HOLD_MS); },
    (e) => { clearTimeout(holdT); if (e?.type === 'pointerup' && !held) act.spell(current); });
  const spellIcon = spellBtn.querySelector('img');
  const picker = h('div', { class: 'touch__picker', hidden: true },
    ...Object.entries(spells).map(([id, s]) => {
      const b = h('button', { type: 'button', class: 'touch__pick', 'data-spell': id, tabindex: '-1' }, icon(s.icon, { size: 22 }), h('small', null, s.name), h('i', null, `${s.mp}`));
      b.addEventListener('click', () => { choose(id); act.spell(id); closePicker(); });
      return b;
    }),
    (() => { const b = h('button', { type: 'button', class: 'touch__pick touch__pick--sig', tabindex: '-1' }, icon('star-swirl', { size: 22 }), h('small', null, 'Buddy move')); b.addEventListener('click', () => { act.signature(); closePicker(); }); return b; })(),
  );
  function choose(id) {
    if (!spells[id]) return;
    current = id;
    spellIcon.src = spellIcon.src.replace(/[^/]+\.svg$/, `${spells[id].icon}.svg`);
    for (const b of picker.querySelectorAll('[data-spell]')) b.classList.toggle('is-on', b.dataset.spell === id);
    opts.onSpell?.(id);
  }
  function openPicker() { picker.hidden = false; el.classList.add('is-picking'); }
  function closePicker() { picker.hidden = true; el.classList.remove('is-picking'); }
  choose(current);

  const useBtn = text(btn('use', 'Use / talk', null, () => act.interact()), 'E');
  const useTag = h('span', { class: 'touch__tag' }, 'Talk');
  useBtn.append(useTag);
  const buttons = h('div', { class: 'touch__btns' },
    btn('attack', 'Attack', 'crossed-swords', () => act.attack()),
    btn('jump', 'Jump', 'upgrade', () => input.setVirtual('Space', true), () => input.setVirtual('Space', false)),
    useBtn,
    btn('dodge', 'Dodge', 'footprint', () => input.tapVirtual('Dodge')),
    spellBtn,
    text(btn('down', 'Down', null, () => input.setVirtual('Down', true), () => input.setVirtual('Down', false)), '▼'),
  );
  const top = h('div', { class: 'touch__top' },
    btn('map', 'Map', 'treasure-map', () => act.map()),
    btn('vehicle', 'Vehicle', 'horse-head', () => act.vehicle()),
    btn('view', 'First / third person', 'eye', () => act.view()),
    btn('menu', 'Menu', 'menu', () => act.menu()),
  );
  el.append(pad, stick, buttons, picker, top);
  root.append(el);

  // ---- the gesture surface: floating stick on the left, look / pinch / tap on the right
  const ptrs = new Map();       // pointerId -> { role, x, y, x0, y0, t0 }
  let stickId = null, cx = 0, cy = 0, pinch = 0;
  const leftZone = () => innerWidth * (innerWidth > innerHeight ? 0.4 : 0.5);
  function stickTo(x, y) {
    // keep the whole ring on screen
    cx = Math.min(Math.max(x, 70), innerWidth - 70);
    cy = Math.min(Math.max(y, 90), innerHeight - 70);
    stick.style.left = `${cx}px`; stick.style.top = `${cy}px`;
    stick.classList.add('is-live');
  }
  function stickMove(x, y) {
    let dx = x - cx, dy = y - cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.stick.x = dx / R; input.stick.y = dy / R;
    input.setVirtual('Sprint', l > R * 1.3);
  }
  function stickEnd() {
    stickId = null;
    knob.style.transform = '';
    stick.style.left = stick.style.top = '';
    stick.classList.remove('is-live');
    input.stick.x = input.stick.y = 0;
    input.setVirtual('Sprint', false);
  }
  const lookers = () => [...ptrs.values()].filter((p) => p.role === 'look');
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!picker.hidden) closePicker();
    capture(pad, e.pointerId);
    const p = { role: 'look', x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp };
    if (stickId == null && e.clientX < leftZone()) { p.role = 'stick'; stickId = e.pointerId; stickTo(e.clientX, e.clientY); stickMove(e.clientX, e.clientY); }
    ptrs.set(e.pointerId, p);
    const l = lookers();
    if (l.length === 2) pinch = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y);
  });
  pad.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.role === 'stick') { stickMove(e.clientX, e.clientY); return; }
    const l = lookers();
    if (l.length >= 2) {
      const d = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y);
      if (pinch) input.addWheel((pinch - d) * 2.5);
      pinch = d;
    } else input.addDrag(dx, dy);
  });
  const end = (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    ptrs.delete(e.pointerId);
    if (p.role === 'stick') { stickEnd(); return; }
    pinch = 0;
    // a quick tap on a name plate talks to that islander (the plates sit under this surface)
    if (e.type === 'pointerup' && e.timeStamp - p.t0 < TAP_MS && Math.hypot(p.x - p.x0, p.y - p.y0) < TAP_PX) {
      const plate = document.elementsFromPoint(p.x, p.y).find((n) => n.classList?.contains('g__plate'));
      plate?.click();
    }
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  const reset = () => {
    for (const id of ptrs.keys()) { try { pad.releasePointerCapture(id); } catch { /* gone */ } }
    ptrs.clear(); pinch = 0;
    stickEnd();
    closePicker();
    clearTimeout(holdT);
    for (const b of el.querySelectorAll('.is-down')) b.classList.remove('is-down');
    input.setVirtual('Space', false); input.setVirtual('Down', false);
  };

  // iOS Safari still pinch-zooms and rubber-bands the page on some gestures despite touch-action:
  // while playing, only a scrolling window (a dialog, the map list) may move
  const noGesture = (e) => e.preventDefault();
  const noScroll = (e) => { if (e.touches.length > 1 || !e.target.closest?.('.modal__panel')) e.preventDefault(); };
  const guard = (on) => {
    const f = on ? 'addEventListener' : 'removeEventListener';
    document[f]('gesturestart', noGesture);
    document[f]('touchmove', noScroll, { passive: false });
  };

  let lastCd = '', lastPoor = null, lastReady = null, lastTag = '', shown = false;
  return {
    el,
    show(on) {
      on = !!on;
      el.classList.toggle('is-on', on);
      if (on !== shown) { shown = on; guard(on); }
      if (!on) reset();
    },
    /** A window (dialog, battle, map, menu) is open: get out of its way and drop held inputs. */
    pause(on) { el.classList.toggle('is-paused', !!on); if (on) reset(); },
    get spell() { return current; },
    choose,
    /** Per frame from index.js: flying (Down button), use prompt, spell cooldown / MP. */
    sync({ flying, ready = null, tag = 'Use', cd = 0, poor = false }) {
      el.classList.toggle('is-flying', !!flying);
      const r = !!ready;
      if (r !== lastReady) { lastReady = r; useBtn.classList.toggle('is-ready', r); }
      if (r && tag !== lastTag) { lastTag = tag; useTag.textContent = tag; }
      const c = cd.toFixed(2);
      if (c !== lastCd) { lastCd = c; spellBtn.style.setProperty('--cd', c); }
      if (poor !== lastPoor) { lastPoor = poor; spellBtn.classList.toggle('is-poor', poor); }
    },
  };
}
