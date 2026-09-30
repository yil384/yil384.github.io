// Page critters (SPEC §2.7). One harmless bug per chapter, from our own cast, living on the card-head
// row (the ribbon row: no body text there), between the ribbon and the seal slot. It turns up once you
// have spent a few seconds in a chapter, never moves toward the pointer, never attacks, and wanders
// off after 40 s if ignored. Bonk it (click, tap, the B key, Bit's bowl or a stomp in walk mode) for a
// little XP and ◈ and its gag. At most two exist (and animate) at a time.
import { frameImg, speak } from './bit.js';
import { registerKey } from './keys.js';
import { $$, h, on, emit, found, rm, isGame, isPlain, sfx, float, bubble, live, onSection, currentSection, sessionOnce, burst } from './kit.js';

const KINDS = {
  about: {
    kind: 'seagull', name: 'Seagull', sprite: 'seagull', scale: 2, fly: true,
    guide: 'Seagull: UCSD\'s true apex predator. Guard your fries.',
  },
  education: {
    kind: 'offbyone', name: 'Off-by-one Slime', sprite: 'slime', scale: 2,
    guide: 'Off-by-one Slime: appears at every loop boundary. Mostly harmless.',
  },
  publications: {
    kind: 'nan', name: 'NaN Slime', sprite: 'slime-dark', scale: 2,
    guide: 'NaN Slime: not equal to anything, including itself.',
  },
  experience: {
    kind: 'legacy', name: 'Legacy Code', sprite: 'skeleton', scale: 2,
    guide: 'Legacy Code: load-bearing. Nobody remembers who wrote it.',
  },
  projects: {
    kind: 'segfault', name: 'Null Pointer', sprite: 'bat', scale: 2, fly: true,
    guide: 'Null Pointer: points at nothing, very fast. Try three times.',
  },
};
const LEGACY_LINES = ['It works. Do not touch.', 'Nobody knows why it works.', 'Deprecated since 2009. Still in production.', 'Please.'];
const SPAWN_AFTER = 4000, LIFE = 40000, RESPAWN = 45000, MAX_ALIVE = 2;

let ctxRef = null;
const alive = new Map();   // section id → critter record
const gone = {};           // kind → time it left (poofed or bonked)
let pendingT = 0;

const enabled = () => isGame() && !isPlain() && ctxRef?.P?.critters !== false && !navigator.connection?.saveData;

// ---------------------------------------------------------------- spawning
function roomFor(card) {
  const head = card?.querySelector(':scope > .card-head');
  const tag = head?.querySelector('.tag');
  if (!head || !tag) return null;
  const hw = head.clientWidth, tw = tag.offsetWidth + tag.offsetLeft;
  const seal = head.querySelector('.seal-slot');
  const sw = seal && seal.offsetWidth ? seal.offsetWidth + 8 : 8;
  const left = tw + 8;
  const room = hw - left - sw;
  if (room < 48) return null;
  return { head, left, w: Math.max(0, room - 48) };
}

function spawn(sec) {
  const def = KINDS[sec.id];
  if (!def || alive.has(sec.id) || !enabled()) return;
  if (gone[def.kind] && performance.now() - gone[def.kind] < RESPAWN) return;
  const card = sec.querySelector(':scope > .card');
  const room = roomFor(card);
  if (!room) return;
  // keep the population small: the oldest one wanders off
  if (alive.size >= MAX_ALIVE) {
    const [oldId] = [...alive.entries()].sort((a, b) => a[1].born - b[1].born)[0];
    poof(alive.get(oldId));
  }
  const f0 = frameImg(def.sprite, def.scale, 0, 'critter__f critter__f0');
  const f1 = def.fly ? frameImg(def.sprite, def.scale, 1, 'critter__f critter__f1') : null;
  const art = h('span', { class: 'critter__art' }, f0, f1);
  if (def.kind === 'nan') art.append(h('span', { class: 'critter__q', 'aria-hidden': 'true' }, '?'));
  if (def.kind === 'legacy') art.append(h('span', { class: 'critter__todo', 'aria-hidden': 'true' }, '// TODO'));
  if ((ctxRef.P.ngplus | 0) > 0) art.append(h('span', { class: 'critter__hat', 'aria-hidden': 'true' }));
  const shift = h('span', { class: 'critter__shift' }, art);
  const walk = h('span', { class: 'critter__walk' }, shift);
  const el = h('button', {
    type: 'button', class: `critter critter--${def.kind}${def.fly ? ' critter--fly' : ''}`, tabindex: '-1', 'data-game': '',
    'aria-label': `${def.name} (harmless). Bonk it.`,
  }, walk);
  el.style.left = `${room.left}px`;
  el.style.setProperty('--w', `${Math.round(room.w)}px`);
  el.style.setProperty('--delay', `${-Math.round(Math.random() * 14)}s`);
  room.head.classList.add('critter-floor');
  room.head.append(el);
  const rec = { el, def, sec, card, born: performance.now(), hits: 0, shift: 0, timers: [], fry: false };
  alive.set(sec.id, rec);
  el.addEventListener('click', (e) => { e.stopPropagation(); hit(rec); });
  // hovering for a moment: Bit reads from the field guide
  let hoverT = 0;
  el.addEventListener('pointerenter', () => { hoverT = setTimeout(() => { if (sessionOnce(`guide:${def.kind}`)) speak('bit', def.guide); }, 600); });
  el.addEventListener('pointerleave', () => clearTimeout(hoverT));
  if (!rm()) el.classList.add('is-in');
  rec.timers.push(setTimeout(() => poof(rec), LIFE));
  if (def.kind === 'seagull') rec.timers.push(setTimeout(() => steal(rec), 11000));
  return rec;
}

function clearTimers(rec) { rec.timers.forEach(clearTimeout); rec.timers = []; }
function remove(rec) {
  clearTimers(rec);
  if (alive.get(rec.sec.id) === rec) alive.delete(rec.sec.id);
  rec.fryEl?.remove();
}
/** Wander off (ignored for too long, or making room). */
function poof(rec) {
  if (!rec || rec.el.classList.contains('is-dead')) return;
  remove(rec);
  rec.el.classList.add('is-dead');
  gone[rec.def.kind] = performance.now();
  if (rm()) { rec.el.remove(); return; }
  rec.el.classList.add('is-poof');
  setTimeout(() => rec.el.remove(), 420);
}

// ---------------------------------------------------------------- the seagull's fry heist
function steal(rec) {
  if (rec.el.classList.contains('is-dead')) return;
  const aside = rec.card.querySelector('.prose .aside');
  if (!aside || !aside.getClientRects().length) return;
  const r = aside.getBoundingClientRect();
  // only while the reader can see it land (otherwise try again a bit later)
  if (r.bottom < 60 || r.top > innerHeight - 40) { rec.timers.push(setTimeout(() => steal(rec), 6000)); return; }
  const before = rec.el.getBoundingClientRect();
  aside.classList.add('critter-perch');
  rec.el.classList.add('is-perched');
  rec.el.style.left = '';
  aside.append(rec.el);
  rec.fry = true;
  rec.fryEl = h('span', { class: 'critter__fry', 'aria-hidden': 'true' });
  rec.el.querySelector('.critter__art').append(rec.fryEl);
  rec.el.setAttribute('aria-label', 'Seagull with a stolen fry (harmless). Bonk it.');
  if (rm()) return;
  const after = rec.el.getBoundingClientRect();
  const dx = before.left - after.left, dy = before.top - after.top;
  rec.el.animate([
    { transform: `translate(${dx}px, ${dy}px)` },
    { transform: `translate(${dx * 0.5 + 30}px, ${dy * 0.5 - 70}px)`, offset: 0.5 },
    { transform: 'none' },
  ], { duration: 900, easing: 'cubic-bezier(.4,0,.3,1)' });
  sfx('squeak');
}

// ---------------------------------------------------------------- bonks
function squash(rec, then) {
  rec.el.classList.add('is-dead');
  sfx('squeak');
  setTimeout(() => sfx('kill'), 110);
  if (rm()) { rec.el.style.opacity = '0'; setTimeout(() => { rec.el.remove(); then?.(); }, 120); return; }
  rec.el.classList.add('is-squash');
  burst(rec.el, { n: 6, kind: 'spark' });
  setTimeout(() => { rec.el.remove(); then?.(); }, 200);
}
function score(rec) {
  const { kind, name } = rec.def;
  remove(rec);
  gone[kind] = performance.now();
  ctxRef.progress.bonk(kind, rec.el);
  emit('page:bonk', { kind, key: rec.sec.querySelector('[data-focus]')?.dataset.focus || rec.sec.dataset.shot });
  live(`Bonked the ${name}.`);
}
function nudge(rec, px) {
  // startled: stop walking, hop px sideways (away from the edge if there is no room)
  const w = parseFloat(rec.el.style.getPropertyValue('--w')) || 0;
  const walkEl = rec.el.querySelector('.critter__walk');
  // where it is now along its path (the walk and the earlier hops are transforms on the inner parts)
  const cur = walkEl.getBoundingClientRect().left - rec.el.getBoundingClientRect().left + rec.shift;
  const d = cur + px > w + 2 ? -px : px;
  rec.el.classList.add('is-hold');
  rec.shift += d;
  rec.el.querySelector('.critter__shift').style.transform = `translateX(${rec.shift}px)`;
}

function hit(rec) {
  if (!isGame() || rec.el.classList.contains('is-dead')) return;
  rec.hits++;
  clearTimers(rec);
  rec.timers.push(setTimeout(() => poof(rec), LIFE));
  const { kind } = rec.def;
  const el = rec.el;
  if (kind === 'offbyone' && rec.hits === 1) {
    // the first bonk lands one step off
    sfx('hit');
    nudge(rec, 28);
    el.classList.remove('is-hop'); void el.offsetWidth; el.classList.add('is-hop');
    float(el, 'i <= n?', { tone: 'teal' });
    return;
  }
  if (kind === 'legacy' && rec.hits < 5) {
    sfx('hit');
    el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake');
    bubble(el, LEGACY_LINES[rec.hits - 1], { place: 'above', ms: 2400 });
    return;
  }
  if (kind === 'segfault' && rec.hits < 3) {
    sfx('hit');
    nudge(rec, 40);
    el.classList.remove('is-blink'); void el.offsetWidth; el.classList.add('is-blink');
    bubble(el, 'Segmentation fault (core dumped)', { place: 'above', ms: 2000 });
    return;
  }
  // a real bonk
  score(rec);
  if (kind === 'seagull') {
    if (rec.fry && rec.fryEl && !rm()) {
      const fry = rec.fryEl;
      const r = fry.getBoundingClientRect();
      const ghost = h('span', { class: 'critter__fry critter__fry--drop', 'aria-hidden': 'true' });
      ghost.style.left = `${r.left}px`; ghost.style.top = `${r.top}px`;
      document.body.append(ghost);
      setTimeout(() => ghost.remove(), 900);
    }
    bubble(el, rec.fry ? 'Seagull: UCSD\'s true apex predator. (The fry is back.)' : 'Seagull: UCSD\'s true apex predator.', { place: 'above', ms: 2800 });
    found('seagull');
  } else if (kind === 'offbyone') {
    renumber();
    found('offbyone');
  } else if (kind === 'nan') {
    ctxRef.hud?.flash?.('NaN', 1500);
    float(el, 'NaN !== NaN', { tone: 'red' });
    found('nan');
  } else if (kind === 'legacy') {
    ctxRef.progress.award({ cash: 5, why: 'Legacy code retired', from: el.closest('.card-head') || el });
    bubble(el, 'Refactored. Tests still pass (there were none).', { place: 'above', ms: 2600 });
    found('legacy');
  } else if (kind === 'segfault') {
    bubble(el, '+3 ◈ · pointer dereferenced safely', { place: 'above', ms: 2600 });
    ctxRef.progress.award({ cash: 3, why: 'Null Pointer caught' });
    found('segfault');
  }
  if (kind === 'legacy') { el.classList.add('is-crumble'); el.classList.add('is-dead'); sfx('boom'); setTimeout(() => el.remove(), rm() ? 0 : 520); }
  else squash(rec);
}

/** Every chapter numeral is off by one for two seconds. */
let renumT = 0;
function renumber() {
  const nums = $$('.tag__n');
  if (!nums.length) return;
  clearTimeout(renumT);
  nums.forEach((n) => {
    if (!n.dataset.n) n.dataset.n = n.textContent;
    n.textContent = String(Math.max(0, parseInt(n.dataset.n, 10) - 1)).padStart(2, '0');
    n.classList.add('is-off');
  });
  renumT = setTimeout(() => nums.forEach((n) => { n.textContent = n.dataset.n; n.classList.remove('is-off'); }), 2000);
}

// ---------------------------------------------------------------- B: bonk the one nearest the middle
function nearest() {
  const mid = innerHeight / 2;
  let best = null, bd = Infinity;
  for (const rec of alive.values()) {
    if (rec.el.classList.contains('is-dead')) continue;
    const r = rec.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const d = Math.abs(r.top + r.height / 2 - mid);
    if (d < bd) { bd = d; best = rec; }
  }
  return best;
}

/** All critters currently on the page (for walk mode). */
export const critters = () => [...alive.values()].filter((r) => !r.el.classList.contains('is-dead')).map((r) => r.el);

export function init(ctx) {
  ctxRef = ctx;
  onSection((cur) => {
    clearTimeout(pendingT);
    if (!cur?.el || !KINDS[cur.id]) return;
    pendingT = setTimeout(function tryNow() {
      if (currentSection()?.el !== cur.el) return;
      if (document.hidden) { pendingT = setTimeout(tryNow, 1000); return; }
      spawn(cur.el);
    }, SPAWN_AFTER);
  });
  registerKey('b', () => {
    const rec = nearest();
    if (!rec) { live('No critters in sight.'); return; }
    hit(rec);
  });
  const clearAll = () => { for (const rec of [...alive.values()]) { remove(rec); rec.el.remove(); } };
  on('page:critters', (onOff) => { if (!onOff) clearAll(); });
  ctx.mode?.onMode?.((st) => { if (st.plain) clearAll(); });
  // New Game+: whoever is around puts on a hat
  on('page:ngplus', () => { for (const rec of alive.values()) if (!rec.el.querySelector('.critter__hat')) rec.el.querySelector('.critter__art')?.append(h('span', { class: 'critter__hat', 'aria-hidden': 'true' })); });
}
