// Page progression (SPEC §2.3): page XP → a *visitor* level (never Yichen's, never the 3D S.player.level),
// plus Triton Cash ◈ (= S.player.gold, shared with the 3D shop). Everything here is idempotent by id and
// harmless: nothing is ever taken away.
import { S } from '../../game3d/state.js';
import { emit, on } from '../../game3d/bus.js';
import { found } from '../eggs.js';
import { P, save, defaults } from './pstate.js';
import { float, flyTo, sfx, toast, burst, live } from './kit.js';

export const THRESHOLDS = [0, 30, 80, 150, 250, 400, 600];
export const TITLES = ['Prospective Student', 'Admitted', 'First-year', 'Quals Passed', 'Candidate (ABD)', 'Dissertating', 'Dr. (Honorary)'];
export const TOKENS_TOTAL = 12;
export const DETAILS_TOTAL = 15;
export const CRITTER_KINDS = ['seagull', 'offbyone', 'nan', 'legacy', 'segfault'];

const listeners = new Set();
export const onProgress = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = (extra = {}) => { const st = { xp: xp(), cash: cash(), level: level(), title: title(), ...extra }; listeners.forEach((f) => { try { f(st); } catch (err) { console.error('[progress]', err); } }); };

export const xp = () => P.xp | 0;
export const cash = () => S.player.gold | 0;
export function level(x = xp()) { let l = 1; for (let i = 0; i < THRESHOLDS.length; i++) if (x >= THRESHOLDS[i]) l = i + 1; return l; }
export const title = (l = level()) => TITLES[Math.max(0, Math.min(TITLES.length, l) - 1)];
/** XP needed for the next level (or null at the cap). */
export const nextAt = (l = level()) => (l < THRESHOLDS.length ? THRESHOLDS[l] : null);
/** 0..1 through the current level. */
export function levelFrac(x = xp()) {
  const l = level(x), lo = THRESHOLDS[l - 1], hi = nextAt(l);
  return hi == null ? 1 : Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
}

const hudEl = (name) => {
  const phone = matchMedia('(max-width: 719px)').matches;
  if (name === 'cash') return phone ? document.getElementById('bar-lv') : document.getElementById('phud-cash');
  if (name === 'xp' || name === 'lv') return document.getElementById(phone ? 'bar-lv' : 'phud-lv');
  return document.getElementById('eggs-btn');
};

/**
 * Give the visitor something. { id, xp, cash, why, from }. With an id it happens once per save (P.once).
 * Floats '+N XP' / '+N ◈' from `from`, updates the HUD, emits page:reward (+ page:levelup / page:hat).
 */
export function award({ id, xp: dx = 0, cash: dc = 0, why = '', from = null } = {}) {
  if (id) { if (P.once[id]) return false; P.once[id] = Date.now(); }
  if (!dx && !dc) { save(); return true; }
  const before = level();
  P.xp = xp() + dx;
  // cash is paid once per save, even across New Game+ (it is shared with the 3D shop)
  if (dc && id) { P.paid = P.paid || {}; if (P.paid[id]) dc = 0; else P.paid[id] = 1; }
  if (dc) S.player.gold = cash() + dc;
  save();
  if (from) {
    if (dx) float(from, `+${dx} XP`, { tone: 'xp' });
    if (dc) setTimeout(() => from.isConnected && float(from, `+${dc} ◈`, { tone: 'cash' }), dx ? 160 : 0);
  }
  const after = level();
  notify({ gained: { xp: dx, cash: dc, why }, leveled: after > before });
  emit('page:reward', { xp: dx, cash: dc, why });
  if (after > before) {
    sfx('levelup');
    const t = title(after);
    emit('page:levelup', { level: after, title: t });
    live(`Level up: level ${after}, ${t}.`);
    if (after >= THRESHOLDS.length) {
      found('phd');
      emit('page:hat');
      toast('Degree conferred', '(honorary, non-transferable, not accredited)', { kind: 'ach', k: 'Lv 7 · Dr. (Honorary)' });
    }
  }
  return true;
}

/** A details panel / flip / node inspect opened for the first time: +5 XP. */
export function markOpened(id, from) {
  if (!id || P.opened[id]) return false;
  P.opened[id] = Date.now();
  P.stats.opened = Object.keys(P.opened).length;
  return award({ id: `open:${id}`, xp: 5, why: 'Details opened', from });
}

/** A Triton token (t1…t12) collected: +2 XP +10 ◈, coin flies to the HUD cash. */
export function token(id, fromEl) {
  if (!id || P.tokens[id]) return false;
  P.tokens[id] = Date.now();
  sfx('coin');
  if (fromEl) { burst(fromEl, { n: 6, kind: 'coin' }); flyTo(fromEl, hudEl('cash')); }
  award({ id: `token:${id}`, xp: 2, cash: 10, why: 'Triton token', from: fromEl });
  emit('page:coin', { id });
  const n = Object.keys(P.tokens).length;
  live(`Triton token ${n} of ${TOKENS_TOTAL}.`);
  if (n >= TOKENS_TOTAL) found('tokens');
  notify();
  return true;
}
export const tokenCount = () => Object.keys(P.tokens).length;

const sessionBonks = {};
/** A page critter bonked: +2 XP +1 ◈ (at most 3 rewarded per kind per session). */
export function bonk(kind, fromEl) {
  if (!kind) return false;
  P.bonks[kind] = (P.bonks[kind] | 0) + 1;
  P.stats.bonks = (P.stats.bonks | 0) + 1;
  sessionBonks[kind] = (sessionBonks[kind] | 0) + 1;
  if (sessionBonks[kind] <= 3) {
    if (fromEl) { burst(fromEl, { n: 3, kind: 'coin' }); flyTo(fromEl, hudEl('cash')); }
    award({ xp: 2, cash: 1, why: 'Bug bonked', from: fromEl });
  } else save();
  if (CRITTER_KINDS.every((k) => P.bonks[k] > 0) || Object.keys(P.bonks).length >= 5) found('exterminator');
  notify();
  return true;
}

/** New Game+: page progress restarts; eggs, ◈, Reviewer mode, reduced motion and first visit stay. */
export function resetPage() {
  const keep = { plain: P.plain, rm: P.rm, critters: P.critters, firstVisit: P.firstVisit, lastVisit: P.lastVisit, paid: P.paid || {}, ngplus: (P.ngplus | 0) + 1 };
  const fresh = defaults();
  for (const k of Object.keys(P)) delete P[k];
  Object.assign(P, fresh, keep);
  save();
  notify({ reset: true });
  emit('page:ngplus', { n: P.ngplus });
}

export const state = () => ({ xp: xp(), cash: cash(), level: level(), title: title(), next: nextAt(), frac: levelFrac() });
export const refresh = () => notify();

// every egg found (from anywhere) is worth 20 XP
on('egg', (id) => award({ id: `egg:${id}`, xp: 20, why: 'Egg found' }));
// the 3D game also changes gold: keep the cash counter honest
on('reward', () => notify());
on('purchase', () => notify());
