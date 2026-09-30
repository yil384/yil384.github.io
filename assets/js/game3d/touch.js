// On-screen controls for touch screens (pointer: coarse), shown only in play mode.
//   left thumb   virtual joystick (push to the rim to sprint)
//   right side   drag anywhere to look around
//   buttons      attack, jump (hold: higher jump, glide, climb while flying), use (E), dodge,
//                spell, vehicle, map, down (while flying), view (first / third person)
// Everything feeds the same input channels as the keyboard (input.stick, setVirtual, addDrag).
import { h, icon } from './util.js';

const capture = (el, id) => { try { el.setPointerCapture?.(id); } catch { /* pointer already gone */ } };

export function createTouch(root, input, act) {
  const el = h('div', { class: 'touch', 'aria-hidden': 'true' });
  const look = h('div', { class: 'touch__look' });
  const knob = h('span', { class: 'touch__knob' });
  const stick = h('div', { class: 'touch__stick' }, knob);
  const btn = (cls, label, ic, down, up = null) => {
    const b = h('button', { type: 'button', class: `touch__btn touch__btn--${cls}`, 'aria-label': label }, ic ? icon(ic, { size: 22 }) : label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('is-down'); down?.(); });
    const release = () => { b.classList.remove('is-down'); up?.(); };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('pointerleave', release);
    return b;
  };
  const buttons = h('div', { class: 'touch__btns' },
    btn('attack', 'Attack', 'crossed-swords', () => act.attack()),
    btn('jump', 'Jump', 'upgrade', () => input.setVirtual('Space', true), () => input.setVirtual('Space', false)),
    btn('use', 'Use', null, () => act.interact()),
    btn('dodge', 'Dodge', 'footprint', () => input.tapVirtual('Dodge')),
    btn('spell', 'Fireball', 'fireball', () => act.spell()),
    btn('down', 'Down', null, () => input.setVirtual('Down', true), () => input.setVirtual('Down', false)),
  );
  buttons.querySelector('.touch__btn--use').textContent = 'E';
  buttons.querySelector('.touch__btn--down').textContent = '▼';
  const top = h('div', { class: 'touch__top' },
    btn('vehicle', 'Vehicle', 'horse-head', () => act.vehicle()),
    btn('view', 'View', 'eye', () => act.view()),
    btn('map', 'Map', 'treasure-map', () => act.map()),
  );
  el.append(look, stick, buttons, top);
  root.append(el);

  // joystick
  let sid = null, cx = 0, cy = 0;
  const R = 52;
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sid = e.pointerId;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    capture(stick, sid);
    moveStick(e);
  });
  const moveStick = (e) => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.stick.x = dx / R; input.stick.y = dy / R;
    input.setVirtual('Sprint', l > R * 1.25);
  };
  const endStick = (e) => {
    if (e.pointerId !== sid) return;
    sid = null;
    knob.style.transform = '';
    input.stick.x = input.stick.y = 0;
    input.setVirtual('Sprint', false);
  };
  stick.addEventListener('pointermove', moveStick);
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  // look: drag on the right side of the screen
  let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', (e) => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; capture(look, lid); });
  look.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; input.addDrag(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; });
  const endLook = (e) => { if (e.pointerId === lid) lid = null; };
  look.addEventListener('pointerup', endLook);
  look.addEventListener('pointercancel', endLook);

  return {
    el,
    show(on) { el.classList.toggle('is-on', !!on); if (!on) { input.stick.x = input.stick.y = 0; knob.style.transform = ''; } },
    sync({ flying }) { el.classList.toggle('is-flying', !!flying); },
  };
}
